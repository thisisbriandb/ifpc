# Spec 03 — Ingestion et parsing

> Objectif : transformer AsCoCid (site + fichiers) en instances du modèle canonique
> (spec 02), de façon **idempotente, reprenable et incrémentale**. Tout le coût est payé
> ici, hors-ligne, pour que le chemin de requête reste vide de traitement lourd.

---

## 1. Pipeline

Six étapes, chacune un exécutable indépendant lisant/écrivant sur disque. Aucune n'appelle
la suivante : l'orchestration est explicite.

```
 collecte  →  normalisation  →  parsing  →  structuration  →  contextualisation  →  indexation
   (§2)          (§3)            (§4)          (§5)               (§6)               spec 04
   ↓ blobs/      ↓ manifeste     ↓ blocs       ↓ graphe          ↓ chunks           ↓ Qdrant
```

**Règle d'or : chaque étape est une fonction pure d'un état sur disque vers un autre.**
Entrée identique ⇒ sortie identique. Cela rend l'ensemble rejouable, testable sur corpus
figé, et interruptible sans perte.

### 1.1 Cache adressé par contenu

Chaque étape produit un artefact nommé par
`sha256(entrée) + sha256(configuration de l'étape) + version_du_code_de_l_étape`.

Conséquences concrètes :

- rejouer l'ingestion après un changement de stratégie de chunking **ne re-parse pas** les
  PDF (le hash de l'étape parsing est inchangé) ;
- changer le prompt d'extraction VLM invalide **uniquement** l'étape structuration ;
- une ingestion interrompue reprend là où elle s'est arrêtée sans état spécial.

C'est la mécanique qui rend l'itération supportable : sans elle, chaque essai coûte une
ingestion complète et l'équipe cesse d'itérer.

---

## 2. Collecte

⚠️ **D2** — le collecteur dépend du mode d'accès tranché en Phase 0.

Deux adaptateurs derrière le même port `SourceCollector` :

| Adaptateur | Quand | Comportement |
|---|---|---|
| `FilesystemCollector` | accès au partage réseau / export | Parcours de l'arborescence, `mtime` + `sha256`, **préféré** : plus rapide, dates fiables, pas de charge sur le site |
| `HttpCollector` | crawl authentifié | Réutilise le crawler de `ascocid-probe` (spec 01 §4) : périmètre par préfixe, concurrence ≤ 4, reprise, jamais d'écriture |

Sortie commune : `blobs/<sha256>` + `manifeste.parquet`
(`source_url`, `sha256`, `mime`, `taille`, `last_modified`, `vu_le`).

**Incrémental** : à chaque passage, on compare le manifeste au précédent.
`nouveau` / `modifié` (sha256 différent) / `supprimé` (absent). Seuls les deux premiers
déclenchent du travail en aval ; les suppressions retirent les chunks de l'index.

---

## 3. Normalisation

- Détection MIME réelle (contenu, pas extension).
- Conversion des bureautiques vers PDF (LibreOffice headless) pour un pipeline unique.
- Rejet motivé et journalisé de ce qui n'est pas traitable (archives, exécutables, vidéo).
- Extraction des métadonnées natives (PDF `/Info`, XMP) : elles portent parfois le code
  documentaire et la date, gratuitement.

---

## 4. Parsing documentaire → `Bloc[]`

Routage par `classe_extraction` (calculée en Phase 0, spec 01 §4.3) :

| Classe | Outil | Sortie |
|---|---|---|
| `texte` | **Docling** (local) — mise en page, titres, tableaux, ordre de lecture | Blocs structurés + tableaux en Markdown |
| `mixte` | Docling + OCR de complément (Tesseract `fra`, ou PaddleOCR) sur les pages pauvres en caractères | idem |
| `scanne` | OCR page entière ; **escalade Claude vision** si le score OCR est faible ou la page contient un tableau/schéma | idem, `confiance` réduite |

Choix de Docling comme parseur par défaut : local (aucune fuite de données, cf. **D1**),
bon sur les tableaux et la structure de titres, sortie déjà proche du modèle `Bloc`. Il
est derrière le port `DocumentParser` — le remplacer par Marker, Unstructured ou un service
externe ne touche aucun autre module.

### 4.1 Extraction du cartouche qualité

Le code documentaire et l'indice de révision sont presque toujours dans un
en-tête/pied de page répété. Stratégie, dans l'ordre :

1. **Regex** sur les zones répétées entre pages (le motif est un livrable de la Phase 0).
2. Métadonnées PDF / nom de fichier.
3. **Repli LLM** (Claude Haiku 4.5, en lot) sur la première page uniquement, avec sortie
   structurée stricte, quand 1 et 2 échouent.
4. Sinon `statut = inconnu` → **exclu de l'index** + anomalie (spec 02 §3).

L'ordre compte : la regex traite ~95 % des cas pour 0 €, le LLM ne voit que la queue de
distribution.

---

## 5. Structuration des logigrammes → `Etape[]`, `Transition[]`

C'est l'étape à plus forte valeur et à plus fort risque. Aiguillage par le cas d'encodage
(spec 01 §3).

### 5.1 Cas A–D et F — parsing déterministe

Extraction exacte, `confiance = 1.0`, coût nul, pas de revue. Priorité absolue :
**toujours** vérifier si le schéma relève d'un de ces cas avant de sortir un VLM.

```python
# Cas B — imagemap : le graphe est déjà écrit dans le HTML
def etapes_depuis_imagemap(html: str, base_url: str) -> list[EtapeBrute]:
    tree = HTMLParser(html)
    etapes = []
    for area in tree.css("map area"):
        etapes.append(EtapeBrute(
            libelle=area.attributes.get("title") or area.attributes.get("alt") or "",
            bbox=parse_coords(area.attributes.get("coords", ""), area.attributes.get("shape")),
            cible=urljoin(base_url, area.attributes.get("href", "")),
            origine="imagemap",
            confiance=1.0,
        ))
    return etapes
```

Un libellé manquant (`alt`/`title` vides) est complété par OCR **restreint à la bbox** de
la zone : on connaît déjà la position, il n'y a aucune ambiguïté à lever.

### 5.2 Cas E — extraction par vision (Claude)

Utilisé **uniquement** en dernier recours. Le schéma est envoyé en image à Claude avec un
schéma de sortie strict.

- Modèle : `claude-opus-5` (lecture de diagrammes = tâche de raisonnement visuel ; un
  modèle plus faible produit des étapes fusionnées et des flèches inventées).
- `output_config: {format: {...}}` + `strict: true` pour garantir un JSON valide.
- `thinking: {type: "adaptive"}`, `output_config.effort: "high"`.
- **Message Batches API** : ingestion non interactive ⇒ **−50 % de coût**. Les résultats
  reviennent dans un ordre quelconque : indexer par `custom_id`, jamais par position.
- Prompt caching sur les consignes + la légende du formalisme (préfixe stable, partie
  variable = l'image, placée après le point de coupure).

Sortie attendue par schéma :

```json
{
  "titre": "Traitement d'une non-conformité",
  "acteurs": ["Opérateur", "Responsable Qualité"],
  "etapes": [
    {"numero": 1, "libelle": "Détecter la non-conformité", "type": "action",
     "acteur": "Opérateur", "bbox": [40, 120, 180, 60],
     "documents_cites": ["FO-QUA-004"]}
  ],
  "transitions": [{"de": 1, "vers": 2, "condition": null}]
}
```

**Contrôles automatiques avant acceptation** :

| Contrôle | Action si échec |
|---|---|
| Tous les `de`/`vers` référencent une étape existante | rejet, relance à effort `max` |
| Aucune étape orpheline (sauf début/fin) | anomalie, revue humaine |
| Codes documentaires cités ∈ corpus connu | code inconnu → non lié, signalé (⚠️ ne **jamais** créer un document à partir d'une hallucination) |
| Nombre d'étapes cohérent avec le nombre de zones cliquables détectées | anomalie |

**Revue humaine obligatoire** sur 100 % des schémas en cas E tant que le taux d'acceptation
automatique mesuré est < 90 %. L'interface de revue est un simple écran image-à-gauche /
JSON-à-droite ; c'est un investissement d'une journée qui évite des mois de réponses
subtilement fausses.

### 5.3 Rattachement document ↔ étape

Trois origines, par confiance décroissante, cumulables :

1. **Lien explicite** (href de la zone cliquable) → `confiance 1.0` ;
2. **Code documentaire cité dans le libellé de l'étape** et résolu dans le référentiel →
   `0.9` ;
3. **Cité par le VLM** → `0.6`, et seulement si le code existe réellement.

La relation est stockée avec son origine (spec 02 §5) : c'est ce qui permettra plus tard
de dire à l'utilisateur *« lien déduit du schéma »* plutôt que d'afficher une certitude
qu'on n'a pas.

---

## 6. Contextualisation des chunks

Décrite en spec 04 §3 (c'est une étape d'ingestion, mais sa justification est une
justification de recherche).

---

## 7. Fraîcheur et réindexation

⚠️ **D6** — par défaut, **passage nocturne incrémental** :

1. collecte → diff du manifeste ;
2. seuls les fichiers nouveaux/modifiés traversent le pipeline ;
3. les chunks des versions disparues sont supprimés de l'index ;
4. les invariants de la spec 02 §6 sont vérifiés ;
5. **publication atomique** : le nouvel index est construit dans une collection Qdrant
   `chunks_<timestamp>`, puis un alias bascule. Aucun état intermédiaire n'est visible par
   les utilisateurs, et le retour arrière est instantané.

Une réindexation complète reste possible et doit tenir en une nuit (critère de conception,
vérifié à chaque jalon).

---

## 8. Observabilité de l'ingestion

Un rapport par exécution, versionné :

| Métrique | Seuil d'alerte |
|---|---|
| Fichiers collectés / traités / en échec | échec > 2 % |
| Répartition par `classe_extraction` | dérive > 10 pts vs référence |
| Documents sans code métier | > 5 % |
| Documents `statut = inconnu` | > 2 % |
| Schémas par cas d'encodage | apparition d'un cas E inattendu |
| Taux d'acceptation automatique des extractions VLM | < 90 % ⇒ revue humaine maintenue |
| Coût API de l'exécution (€) | > 120 % de la médiane des 7 dernières |
| Durée totale | > 8 h |

Ces chiffres sont écrits dans un fichier, pas seulement dans des logs : leur évolution
dans le temps est le meilleur détecteur de régression silencieuse de l'ingestion.
