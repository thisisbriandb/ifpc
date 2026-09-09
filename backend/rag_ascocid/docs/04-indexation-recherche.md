# Spec 04 — Indexation et recherche

> La recherche est le facteur limitant de la qualité d'un RAG. Un excellent modèle de
> génération sur de mauvais passages produit une mauvaise réponse ; un modèle moyen sur
> les bons passages produit une bonne réponse. **Tout l'effort d'ingénierie va donc ici.**

---

## 1. Chaîne de recherche

```
requête
  │
  ├─ 1. Routage d'intention          (règles + regex, < 1 ms)
  │
  ├─ 2a. Voie EXACTE ──────► FTS5 sur codes/titres ────────────────┐
  │                                                                 │
  ├─ 2b. Voie STRUCTURE ───► graphe SQLite (processus/étapes) ─────┤
  │                                                                 │
  └─ 2c. Voie SÉMANTIQUE ──► Qdrant hybride (dense+sparse) ────────┤
                                    │                               │
                                    └─ 3. fusion RRF ──► 4. rerank ─┴─► 5. expansion graphe
                                                                          │
                                                                          ▼
                                                                    contexte → spec 05
```

Chaque voie est un adaptateur derrière le port `Retriever` ; les combiner est une décision
de configuration, pas de code.

---

## 2. Découpage (chunking)

Le découpage se fait sur les `Bloc` (spec 02 §2.2), donc **après** le parsing structuré —
jamais sur une chaîne de caractères brute.

Règles :

| # | Règle | Raison |
|---|---|---|
| C1 | Taille cible **400–700 tokens**, marge dure 1 000 | Compromis mesuré entre précision de la récupération et suffisance du contexte |
| C2 | **Aucun chunk ne traverse une frontière de section** de niveau ≤ 2 | Un chunk à cheval sur deux procédures est irrécupérable proprement |
| C3 | Un **tableau reste entier** ; s'il dépasse la marge, il est découpé par groupes de lignes avec **l'en-tête répété** | Un fragment de tableau sans en-tête est illisible pour le modèle |
| C4 | Chevauchement de ~15 % **uniquement entre chunks d'une même section** | |
| C5 | Chaque chunk **hérite** de `titre_section`, `page`, `etapes[]`, `processus[]`, `statut` | Sans ces métadonnées, ni filtrage ni citation ni retour au schéma |
| C6 | Un chunk trop court (< 80 tokens) est **fusionné** avec son voisin | Évite le bruit d'index |

---

## 3. Contextualisation des chunks (contextual retrieval)

**Le problème** : découpé, un chunk perd son ancrage. *« Elle doit être visée sous 48 h par
le responsable. »* — quoi, dans quel processus, quel document ? Ni le vecteur ni BM25 ne
peuvent le retrouver correctement.

**La solution** : à l'ingestion, on préfixe chaque chunk de 1 à 3 phrases situant le
passage dans son document, générées par un modèle. On indexe `contexte + texte`, on
**affiche `texte`**. C'est la technique publiée par Anthropic sous le nom *contextual
retrieval* ; l'effet mesuré publiquement est une réduction d'environ 49 % des échecs de
récupération, ~67 % en la combinant au reranking. C'est le meilleur rapport
effort/résultat de toute cette spec.

Mise en œuvre :

- modèle : **`claude-haiku-4-5`** (tâche simple et massive ; on ne mobilise pas Opus ici) ;
- **prompt caching sur le document entier** : le document complet est envoyé une fois en
  préfixe caché, puis chaque chunk est traité en suffixe variable. Sans cela le coût est
  prohibitif ; avec, les lectures de cache coûtent ~0,1× le prix d'entrée ;
- **Message Batches API** : −50 % supplémentaires, l'ingestion n'étant pas interactive ;
- point de coupure du cache **à la fin du document**, avant le chunk — sinon chaque
  requête écrit une entrée de cache jamais relue (surcoût pur) ;
- vérification obligatoire : `usage.cache_read_input_tokens > 0` dès la 2ᵉ requête d'un
  même document. S'il reste à zéro, un invalidant silencieux est présent — ne pas déployer
  l'étape sans cette assertion en test.

Sortie stockée dans `chunk.contexte`, régénérable indépendamment du reste (§ cache
d'étape, spec 03 §1.1).

---

## 4. Embeddings et index

⚠️ **D1** — les embeddings sont **locaux dans tous les cas** : c'est le composant qui voit
100 % du corpus, autant qu'il ne sorte pas, et cela supprime une dépendance réseau du
chemin de requête.

**Modèle retenu : BGE-M3.**

| Critère | Pourquoi BGE-M3 |
|---|---|
| Français | Multilingue nativement, bon niveau sur le français technique |
| Hybride en une passe | Produit **dense (1024 d.) + sparse lexical** simultanément — pas besoin d'un BM25 séparé pour le sémantique |
| Contexte long | 8 192 tokens : aucun chunk ne sera tronqué |
| Local | CPU acceptable, GPU confortable ; latence maîtrisée |

Alternatives derrière le même port `Embedder`, si l'évaluation le justifie : `solon-embeddings`
(spécialisé français), Voyage AI (hébergé, à n'envisager que si **D1** l'autorise).

**Index : un tableau numpy en mémoire — pas Qdrant.**

Qdrant était le choix par défaut sous l'hypothèse d'un corpus de plusieurs
dizaines de milliers de pages. La Phase 0 a mesuré la réalité : **1 713 chunks**.
Les vecteurs pèsent 5 Mo, et une recherche exhaustive par produit matriciel coûte
**3,4 ms mesurés** — moins que le seul aller-retour réseau vers un service
externe. Un conteneur à exploiter, une dépendance à suivre et un mode de panne
supplémentaire, pour un gain négatif.

L'interface `IndexVectoriel` est respectée : si le corpus décuple, on écrit un
adaptateur Qdrant et rien d'autre ne bouge. C'est précisément ce que
l'architecture hexagonale achète — le droit de commencer simple.

**Modèle d'embedding : `intfloat/multilingual-e5-base`** (768 dimensions), et non
BGE-M3. L'argument principal de BGE-M3 — produire dense *et* sparse en une passe —
ne vaut pas ici : la voie lexicale est déjà couverte par FTS5, qui traite mieux
les termes exacts du glossaire. E5-base est deux fois plus léger pour une qualité
équivalente sur du français technique.

⚠️ Les modèles E5 exigent un préfixe `query: ` / `passage: `. L'omettre dégrade
le rappel **sans aucune erreur** — c'est un piège silencieux, encapsulé dans
l'adaptateur.

## 5. Recherche hybride et fusion

- Requête dense + requête sparse envoyées ensemble à Qdrant, `limit = 50` chacune.
- **Fusion RRF** (Reciprocal Rank Fusion) côté serveur : robuste, sans paramètre à
  calibrer, elle ne demande pas de normaliser des scores incomparables.
- La voie **FTS5** (§6.1) est fusionnée au même niveau : un code documentaire exact doit
  pouvoir remonter premier même si sa similarité sémantique est faible.

### 5.1 Reranking

Top-50 fusionné → **`bge-reranker-v2-m3`** (local, multilingue) → **top-8** transmis à la
génération.

Le reranker est un modèle croisé : il lit la requête et le passage ensemble, là où
l'embedding les a vus séparément. C'est le second meilleur rapport effort/résultat après la
contextualisation, pour ~80–250 ms.

---

## 6. Routage d'intention

Toutes les questions ne méritent pas le même chemin. Faire passer *« où est PR-QUA-012 ? »*
par un LLM, c'est payer 2 secondes et quelques centimes pour un `SELECT`.

| Intention | Détection | Chemin | Latence cible |
|---|---|---|---|
| **Outil de la plateforme** — « calcule mon barème de pasteurisation », « interpréter ma mesure de couleur » | registre `config/outils.json` : un sujet d'outil **et** une tournure d'action | **Renvoi vers l'outil**, pas de réponse générée | **< 50 ms** |
| **Lookup exact** — un code, un titre exact | correspondance FTS5 forte sur un titre de fiche | FTS5 → **réponse directe sans LLM** : fiche et lien | **< 150 ms** |
| **Navigation** — « quelles étapes après le contrôle réception ? » | mots-clés de structure + entité reconnue | Graphe SQLite → rendu structuré | < 400 ms |
| **Factuelle** — « quel délai pour… ? » | défaut | Hybride + rerank + génération | TTFT < 1,5 s |
| **Synthèse** — « compare X et Y » | marqueurs de comparaison, ou > 1 processus détecté | Hybride élargi + effort supérieur | TTFT < 2,5 s |

### 6.0 Le renvoi vers les outils de la plateforme

La plateforme IFPC héberge déjà des outils d'aide à la décision — pasteurisation,
colorimétrie, et d'autres. **Le chatbot ne doit pas expliquer comment les utiliser :
il doit y renvoyer.**

La difficulté n'est pas de reconnaître le *sujet* mais l'*intention*. Deux questions
portent sur la pasteurisation et n'appellent pas la même réponse :

| Question | Attendu |
|---|---|
| « Pourquoi pasteuriser un cidre ? » | Le Livre répond — c'est un phénomène documenté |
| « Quel barème pour mon lot à 65 °C ? » | L'outil répond — c'est un calcul sur des données propres à l'utilisateur |

La distinction est *explication* contre *calcul sur mon cas*. Une similarité sémantique
seule ne la fait pas : les deux phrases sont proches. Le registre croise donc deux
signaux — un **sujet** d'outil et une **tournure d'action** (« calculer », « mon »,
« combien pour »).

**Règle de prudence : en cas de doute, on répond ET on renvoie.** Un renvoi surnuméraire
coûte un clic ; une réponse retenue à tort prive l'utilisateur d'une information que le
Livre contenait. La bascule vers un renvoi exclusif ne se fait que sur les cas où
l'évaluation montre que la réponse générée n'apportait rien.

### 6.2 Pourquoi un modèle, et non des règles

Une version antérieure de cette spec écartait le LLM pour le routage, au motif qu'un
classifieur ajouterait 300–600 ms au chemin critique. **Deux mesures ont invalidé ce
raisonnement.**

*La latence.* L'objection supposait un TTFT de 1,2 s. Le TTFT mesuré en conditions
réelles est de **5 à 7 s** (spec 05 §7). Un classifieur pèse donc ~8 % du total : il ne
se voit pas.

*La nature du problème.* L'embedding ne peut pas porter le routage. Mesuré sur ce
corpus, une phrase et sa négation exacte obtiennent **0,959** de similarité :

| Paire | Similarité |
|---|---:|
| « une fermeté élevée traduit une sous-maturité » ↔ « **ne** traduit **pas** » | 0,959 |
| « à quelle température fermenter » ↔ « le refroidissement des moûts » | 0,915 |

Un outil qui place une phrase plus près de son contraire que d'une paraphrase donne une
**proximité de sujet**, pas une intention. Il ne séparera jamais « pourquoi pasteuriser ? »
de « quel barème pour mon lot ? » — deux questions au même sujet, aux réponses opposées.

Les règles, elles, échouent sur la langue d'atelier : « brett bouteille ? » et
« densité arrêt ferm ? » sont déjà mal traitées aujourd'hui.

### 6.3 Un seul appel, trois sorties

L'analyse produit en une requête ce que trois appels feraient séparément :

```json
{"intention": "corpus | outil | lookup | navigation | conversation | clarification",
 "requete_recherche": "température de fermentation pour les pommes douces",
 "outil_suggere": "pasteurisation | null",
 "entites": {"processus": "fermentation", "variete": "douce"},
 "confiance": 0.86}
```

`requete_recherche` règle le multi-tours sans appel supplémentaire : « et pour les
pommes douces ? » est réécrit avec le contexte du tour précédent.

**Des raccourcis déterministes s'exécutent avant l'appel** — correspondance exacte avec
un titre de fiche, salutation, question vide. Ils coûtent moins d'une milliseconde et
évitent le modèle sur une part réelle du trafic.

**Le classifieur est un indice, pas une barrière.** En cas de doute, on route vers le
corpus, chemin sûr. Une classification erronée qui *retient* une réponse est plus grave
qu'une qui en produit une de trop — c'est la règle de prudence du §6.0, appliquée deux
fois.

### 6.1 La voie exacte n'est pas optionnelle

Dans un référentiel qualité, une part importante des requêtes contient une **référence
littérale** (`PR-QUA-012`, `FO-04 indice C`). Les embeddings sont mauvais sur ce type de
jeton : `PR-QUA-012` et `PR-QUA-013` sont quasi identiques dans l'espace vectoriel et
totalement différents dans la réalité. FTS5 avec tokenizer `unicode61 remove_diacritics 2`
règle le problème pour un coût nul.

---

## 7. Filtres

Appliqués systématiquement, avant tout scoring :

| Filtre | Valeur par défaut | Note |
|---|---|---|
| `statut` | `= en_vigueur` | **Non désactivable** en usage normal ; un mode « historique » explicite peut lever le filtre, avec bandeau d'avertissement |
| `processus` | libre | Restreint par l'utilisateur ou déduit du contexte de conversation |
| `type_doc` | libre | « seulement les formulaires », etc. |
| ACL | ⚠️ **D4** — sans objet par défaut | Si des droits existent, le filtre est appliqué **dans la requête Qdrant**, jamais à l'affichage : un passage non autorisé ne doit pas atteindre le modèle |

---

## 8. Expansion par le graphe

Après le reranking, on **complète** le contexte avec les voisins immédiats dans le graphe
métier — l'apport propre à AsCoCid, celui qu'un RAG générique ne peut pas faire :

1. pour chaque chunk retenu, remonter aux `Etape` qui référencent son document ;
2. joindre les libellés d'étape, l'acteur, le titre du logigramme et les transitions
   sortantes ;
3. transmettre ces éléments au modèle **en tant que contexte structuré séparé**, et non
   mélangés au texte des documents.

Effet : le modèle peut répondre *« cette vérification intervient à l'étape 4 du logigramme
Réception, réalisée par le Responsable Qualité ; si elle échoue, on passe à l'étape 7 »* —
alors qu'aucun document ne contient cette phrase. C'est la structure du site, restituée en
langage naturel.

Budget : ≤ 1 requête SQLite récursive, < 10 ms.

---

## 9. Latence — **mesurée**

Chemin de recherche complet, 18 exécutions sur 6 questions réelles, corpus de
1 713 chunks, CPU sans GPU :

| Poste | Mesure |
|---|---:|
| Embedding de la requête (E5-base, CPU) | **90 ms** |
| Recherche vectorielle (1 713 vecteurs, numpy) | **3,4 ms** |
| Recherche lexicale (FTS5) | **1,8 ms** |
| Fusion RRF + diversité + hydratation SQLite | ~5 ms |
| **Recherche hybride complète** | **p50 90 ms · p95 105 ms · max 137 ms** |

Le budget de 410 ms p95 est tenu avec de la marge. **96 % du temps est
l'embedding de la requête** : c'est le seul levier si l'on doit accélérer
(modèle plus petit, export ONNX, ou GPU). La recherche elle-même est gratuite.

> **Contrainte d'exploitation à ne pas manquer** : charger le modèle coûte
> **9,2 s**. Négligeable dans un service qui le charge une fois au démarrage,
> rédhibitoire pour un outil en ligne de commande qui le recharge à chaque appel.
> C'est un argument de fond pour l'API persistante de la spec 07, et non un
> détail d'implémentation.

## 10. Ce qu'on ne fait pas en v1

| Écarté | Pourquoi |
|---|---|
| Multi-vecteurs / ColBERT complet | Coût d'index ×5 pour un gain marginal après reranking |
| Re-formulation de requête par LLM | +400 ms sur le chemin critique ; à réévaluer **si et seulement si** l'évaluation montre un déficit de rappel sur les questions mal formulées |
| RAG agentique multi-tours | Latence incompatible avec la contrainte produit ; le routage §6 couvre le besoin réel |
| Fine-tuning d'embeddings | Nécessite un volume de données annotées qu'on n'aura pas avant plusieurs mois d'usage |
| Base graphe dédiée (Neo4j) | Voir spec 02 §4 |

Chacun de ces points est réévaluable **sur preuve chiffrée** issue du jeu d'évaluation, pas
sur intuition.
