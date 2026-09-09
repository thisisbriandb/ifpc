# Spec 06 — Architecture logicielle

> Contrainte du projet : *modularité et maintenabilité*. Traduction concrète : on doit
> pouvoir **changer le parseur PDF, le modèle d'embedding, l'index vectoriel ou le
> fournisseur de LLM sans toucher au code métier**. Aucune de ces quatre briques n'est
> stable à 18 mois ; l'architecture doit l'assumer dès maintenant.

---

## 1. Style : hexagonal (ports et adaptateurs), monolithe modulaire

Le noyau (domaine + cas d'usage) ne connaît que des **interfaces**. Les technologies
vivent en périphérie, dans des adaptateurs interchangeables.

```
                 ┌─────────────────────────────────────────────┐
   HTTP / CLI ──►│  application/  (cas d'usage, orchestration)  │
                 │  ┌───────────────────────────────────────┐  │
                 │  │  domain/  (entités, règles, ports)     │  │
                 │  │  ── aucune dépendance externe ──       │  │
                 │  └───────────────────────────────────────┘  │
                 └──────────────────┬──────────────────────────┘
                                    │ implémente les ports
        ┌───────────┬───────────┬───┴───────┬────────────┬───────────┐
   Docling    BGE-M3      Qdrant      SQLite       Claude      Crawler
   (parsing)  (embed)     (vecteurs)  (graphe)     (LLM)       (collecte)
```

**Pourquoi ce style ici, et pas un framework RAG.** Un pipeline RAG est une longue chaîne
de transformations dont chaque maillon est une décision technologique révisable. C'est
exactement le cas d'usage de l'architecture hexagonale. À l'inverse, les frameworks RAG
généralistes (LangChain, LlamaIndex) imposent leurs abstractions au cœur du code : quand
le besoin s'écarte de leur chemin nominal — et le graphe processus/étape/document
d'AsCoCid s'en écarte fortement — on se bat contre le framework, et les mises à jour
cassent le code métier. **Décision : pas de framework RAG dans le noyau.** Les briques
utiles sont prises directement (Docling, sentence-transformers, client Qdrant, SDK
Anthropic), chacune derrière un port. Le volume de code de liaison est de l'ordre de 1 500
à 2 500 lignes — largement inférieur au coût d'entretien d'une dépendance à un framework
en évolution rapide.

### 1.1 Règle de dépendance

`domain` ne dépend de rien. `application` dépend de `domain`. `infrastructure` dépend des
deux. **Aucune flèche ne pointe vers l'intérieur depuis l'extérieur.** Vérifié
automatiquement en CI (import-linter) : c'est la seule règle d'architecture qui tient dans
la durée si une machine la vérifie.

---

## 2. Arborescence

```
rag_ascocid/
├── docs/                          # ces specs
├── pyproject.toml                 # uv / hatchling
├── src/ascocid/
│   ├── domain/                    # ── cœur, zéro dépendance externe ──
│   │   ├── modeles.py             # Processus, Logigramme, Etape, Document, Chunk (pydantic)
│   │   ├── identifiants.py        # génération des URI ascocid:// (spec 02 §2.1)
│   │   ├── invariants.py          # I1–I7 (spec 02 §6)
│   │   └── ports/
│   │       ├── collecteur.py      # SourceCollector
│   │       ├── parseur.py         # DocumentParser, DiagramParser
│   │       ├── embedder.py        # Embedder
│   │       ├── index.py           # VectorIndex, LexicalIndex
│   │       ├── graphe.py          # GraphStore
│   │       ├── llm.py             # LlmClient
│   │       └── reranker.py        # Reranker
│   │
│   ├── application/               # ── cas d'usage ──
│   │   ├── ingestion/
│   │   │   ├── collecte.py  normalisation.py  parsing.py
│   │   │   ├── structuration.py   # logigrammes → étapes (spec 03 §5)
│   │   │   ├── chunking.py  contextualisation.py  indexation.py
│   │   │   └── pipeline.py        # enchaînement + cache d'étape (spec 03 §1.1)
│   │   └── requete/
│   │       ├── routage.py         # intentions (spec 04 §6)
│   │       ├── recherche.py       # hybride + fusion + rerank
│   │       ├── expansion.py       # voisinage graphe (spec 04 §8)
│   │       ├── prompt.py          # assemblage + points de coupure cache (spec 05 §2)
│   │       └── reponse.py         # streaming + mapping des citations
│   │
│   ├── infrastructure/            # ── adaptateurs, un dossier par techno ──
│   │   ├── collecte/     http.py  fichiers.py
│   │   ├── parsing/      docling.py  pymupdf.py  ocr_tesseract.py  vision_claude.py
│   │   ├── schemas/      imagemap.py  svg.py  pdf_liens.py  visio.py  vision_claude.py
│   │   ├── embeddings/   bge_m3.py  [voyage.py]
│   │   ├── index/        qdrant.py  sqlite_fts.py
│   │   ├── graphe/       sqlite.py
│   │   ├── llm/          anthropic.py
│   │   └── rerank/       bge_reranker.py
│   │
│   ├── interfaces/
│   │   ├── api/          app.py  routes.py  sse.py       # FastAPI (spec 07)
│   │   ├── cli/          probe.py  ingest.py  eval.py  admin.py
│   │   └── web/                                           # UI
│   │
│   └── config.py                  # pydantic-settings, une source unique
│
├── tests/
│   ├── unitaires/                 # domaine + application, adaptateurs simulés
│   ├── integration/               # avec Qdrant conteneurisé
│   ├── corpus_fige/               # 30 documents + 10 logigrammes annotés → non-régression
│   └── eval/                      # jeu d'or (spec 08)
└── deploy/  compose.yaml  Containerfile
```

**Un dossier = une responsabilité, un fichier = une raison de changer.** Quand un nouveau
cas d'encodage de schéma apparaît (spec 01 §3), il ajoute un fichier dans
`infrastructure/schemas/` et une ligne dans une table d'aiguillage. Rien d'autre ne bouge.

---

## 3. Ports

```python
class Embedder(Protocol):
    def encoder(self, textes: Sequence[str], *, requete: bool = False) -> EmbeddingsHybrides: ...
    @property
    def dimension(self) -> int: ...
    @property
    def identifiant_modele(self) -> str: ...   # stocké avec l'index : un changement
                                               # de modèle impose une réindexation
class VectorIndex(Protocol):
    def upserter(self, chunks: Sequence[ChunkIndexe]) -> None: ...
    def rechercher(self, req: RequeteHybride, filtres: Filtres, limite: int) -> list[Resultat]: ...
    def supprimer(self, version_ids: Sequence[str]) -> None: ...
    def basculer_alias(self, nom_collection: str) -> None: ...   # publication atomique

class DiagramParser(Protocol):
    def prend_en_charge(self, cas: CasEncodage) -> bool: ...
    def extraire(self, source: SourceSchema) -> ResultatExtraction: ...  # étapes + confiance
```

Chaque port porte une **notion de confiance** dans sa sortie quand l'extraction est
faillible. C'est ce qui permet de propager l'incertitude jusqu'à l'interface (spec 07 §4)
au lieu de la perdre silencieusement à la première frontière de module.

---

## 4. Stack

| Rôle | Choix | Pourquoi |
|---|---|---|
| Langage | **Python 3.12** | Écosystème document/ML ; déjà présent sur la machine |
| Dépendances | **uv** | Résolution rapide, lockfile reproductible (⚠️ non installé : `curl -LsSf https://astral.sh/uv/install.sh \| sh`) |
| Modèles de données | **pydantic v2** | Validation aux frontières, sérialisation, un seul modèle domaine/API |
| API | **FastAPI** + SSE | Streaming natif, typage, OpenAPI généré |
| Graphe / métadonnées | **SQLite** (WAL, FTS5) | Zéro exploitation, requêtes récursives, migration PostgreSQL possible |
| Vecteurs | **Qdrant** (conteneur) | Hybride, filtres indexés, snapshots |
| Parsing | **Docling**, PyMuPDF | Local, structuré, tableaux |
| Embeddings / rerank | **BGE-M3**, **bge-reranker-v2-m3** | Local, multilingue, hybride en une passe |
| LLM | **SDK `anthropic`** | Citations natives, prompt caching, Batches |
| Journalisation | **structlog** (JSON) + **OpenTelemetry** | Traces bout en bout : chaque requête porte le détail de ses postes de latence |
| Qualité | ruff, mypy (strict sur `domain`), pytest, import-linter | |
| Exécution | **podman compose** | Déjà présent sur la machine |

---

## 5. Configuration

Une seule source, `config.py` (pydantic-settings) : variables d'environnement + fichier
`.env` pour le local. **Aucun secret dans le code ni dans les specs.** Le profil actif
(`dev` / `preprod` / `prod`) ne change que des valeurs, jamais du code.

Les choix d'adaptateurs sont eux aussi de la configuration :

```toml
[adaptateurs]
collecteur = "fichiers"       # http | fichiers
parseur    = "docling"        # docling | pymupdf
embedder   = "bge_m3"         # bge_m3 | voyage
index      = "qdrant"
llm        = "anthropic"

[llm]
modele_reponse         = "claude-opus-5"
modele_contextualisation = "claude-haiku-4-5"
effort_reponse         = "medium"
```

Changer d'embedder est une ligne de configuration **plus** une réindexation — d'où
`identifiant_modele` stocké avec l'index (§3), qui rend l'incohérence détectable au
démarrage plutôt qu'à l'usage.

---

## 6. Tests

| Niveau | Portée | Exigence |
|---|---|---|
| Unitaires | `domain` + `application` avec adaptateurs simulés | Rapides (< 10 s), aucune E/S réseau |
| Contrats de port | Une même suite exécutée contre **tous** les adaptateurs d'un port | Garantit l'interchangeabilité — sans cela, les ports sont décoratifs |
| Intégration | Qdrant + SQLite conteneurisés, corpus figé de 30 documents | Exécutés en CI |
| Non-régression d'extraction | 10 logigrammes annotés (spec 01, livrable 4) | Le nombre d'étapes et les liens document ne régressent pas |
| Cache LLM | Deux requêtes identiques ⇒ `cache_read_input_tokens > 0` | Bloquant (spec 05 §3) |
| Architecture | import-linter | La règle de dépendance §1.1 est vérifiée, pas espérée |
| Évaluation | spec 08 | Sur seuils, hors CI par défaut (coût) |

---

## 7. Déploiement

Trois conteneurs : `api` (FastAPI + modèles locaux), `qdrant`, et `ingestion` (tâche
ponctuelle, déclenchée par cron). SQLite et `blobs/` sur un volume persistant.

Une réindexation ne redémarre jamais l'API : publication par bascule d'alias Qdrant
(spec 03 §7), retour arrière instantané.

**Ressources** : les modèles locaux (BGE-M3 + reranker) tiennent en CPU sur ce volume, mais
un GPU divise la latence d'embedding et de rerank par 3 à 5 et raccourcit fortement
l'ingestion initiale. À arbitrer au jalon J3 avec des mesures réelles.
