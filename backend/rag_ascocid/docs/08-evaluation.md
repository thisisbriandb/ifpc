# Spec 08 — Évaluation et qualité

> Sans mesure, l'amélioration d'un RAG est une suite d'intuitions. Chaque décision ouverte
> des specs 04 et 05 (modèle, effort, taille de chunk, top-k, contextualisation) se tranche
> **sur chiffres**. Le jeu d'évaluation est donc un livrable de même rang que le code.

---

## 1. Le jeu d'or

**Origine : les utilisateurs, pas l'équipe.** 30 à 60 questions verbatim sont collectées en
Phase 0 (spec 01 §1.5). On les complète jusqu'à **100–150 questions** en couvrant
explicitement chaque catégorie ci-dessous.

| Catégorie | Part cible | Exemple |
|---|---:|---|
| Lookup exact | 15 % | « Où est PR-QUA-012 ? » |
| Factuelle simple | 30 % | « Quel délai pour viser une dérogation ? » |
| Navigation / structure | 20 % | « Quelles étapes après le contrôle réception ? » |
| Multi-documents | 15 % | « Différence entre la procédure achats et la procédure sous-traitance ? » |
| **Sans réponse** | **10 %** | question hors référentiel → **l'abstention est la bonne réponse** |
| Piège de version | 5 % | question dont la réponse a changé entre deux indices |
| Mal formulée / abrégée | 5 % | « délai dérog fournisseur ? » |

Les deux catégories en gras sont celles que les jeux d'évaluation maison oublient
systématiquement, et ce sont celles qui détectent les régressions les plus graves.

### 1.1 Annotation

> **L'objet mesuré est la réponse.** Le produit ne promet pas d'indiquer où
> chercher — il promet de répondre. Les métriques de recherche (§2.1) existent
> pour *diagnostiquer* un échec, jamais pour constater un succès : un système
> qui récupère parfaitement et rédige mal serait excellent selon elles et
> inutile en pratique.

Chaque question porte donc, **par ordre d'importance** :

| # | Champ | Sur quelle part | Pourquoi |
|---|---|---|---|
| 1 | **Réponse attendue** — 2 à 4 phrases, dans les mots du métier | **toutes** | C'est ce que le produit doit produire. Sans elle, la qualité de réponse n'est pas mesurable. |
| 2 | **Source(s)** qui l'étayent (idoc, section) | **toutes** | Contrôle de la réponse : distingue une réponse juste d'une invention plausible. Sert aussi au diagnostic (§2.1). |
| 3 | Forme attendue | toutes | fait / procédure / arbitrage / « ça dépend de X » — voir ci-dessous |
| 4 | Temps de recherche manuel | toutes | la référence que le projet doit battre (§1.2) |
| 5 | Catégorie | toutes | §1 |

**Le champ 3 est celui qu'on oublie et qui décide de l'utilité.** Beaucoup de
questions de producteur n'appellent pas un fait mais un arbitrage : *« à quelle
température fermenter ? »* n'a pas de réponse unique, la bonne réponse est
« ça dépend de l'objectif et du type de cidre, voici les plages ». Un système
qui restitue un chiffre isolé a récupéré le bon passage **et raté la demande**.
Noter la forme attendue est ce qui permet de mesurer cet écart.

**Coût réel** : ~4 minutes par question, soit ~4 h d'expert pour 60 questions,
réparties sur 6–8 personnes — moins d'une heure chacune. C'est finançable, et
c'est le seul investissement du projet qui ne peut être remplacé par du code.

**L'annotation vient du geste habituel.** Les producteurs cherchent déjà eux-mêmes :
pour dire la réponse, ils ouvrent la fiche et la lisent. Les champs 1 et 2 sont
donc produits dans le même mouvement — le « où » est un sous-produit du « quoi »,
pas un substitut. L'annotation est faite par un référent métier, pas par l'équipe
technique.

### 1.2 Ligne de base à battre

Deux références sont relevées pendant la collecte, sans coût supplémentaire :

- **le temps de recherche manuel** par question — l'argument du projet
  (« 4 minutes → 3 secondes ») ne se reconstitue pas après coup ;
- **le score d'une recherche lexicale simple** (BM25 sur le corpus). Si le stack
  vectoriel + reranking ne le dépasse pas nettement, il ne justifie pas sa
  complexité. Cette base est mesurée dès que le jeu d'or existe.

### 1.3 Découpage

`train` 40 % / `validation` 30 % / `test` 30 %. Le `test` n'est **jamais** consulté pendant
le réglage ; il est mesuré à chaque jalon et c'est lui qu'on publie. Sans cette discipline,
on optimise pour son propre jeu d'exemples et on croit progresser.

---

## 2. Métriques

### 2.1 Réponse — **les métriques de tête**

Ce sont elles qui disent si le produit fonctionne. Un manquement ici n'est pas
compensable par de bons scores de recherche.

| Métrique | Méthode | Seuil v1 |
|---|---|---|
| **Utilité** — la réponse traite-t-elle la demande, dans la forme attendue (fait / procédure / arbitrage) ? | Juge LLM contre la réponse attendue + la forme annotée, 0–3 | **≥ 2,5 / 3** |
| **Exactitude** — la réponse est-elle juste au regard de la réponse attendue ? | Juge LLM, binaire, désaccords tranchés à la main | **≥ 0,95** |
| **Fidélité** — chaque affirmation est-elle étayée par les passages fournis ? | Juge LLM, par affirmation | **≥ 0,97** |
| **Abstention correcte** | % des questions sans réponse où le système s'abstient | **≥ 0,95** |
| **Exactitude des citations** — la source citée soutient-elle réellement l'affirmation ? | Vérification programmatique contre l'annotation | ≥ 0,95 |
| Complétude | La réponse omet-elle une condition/nuance présente dans la réponse attendue ? | ≥ 0,85 |
| Rattachement au bon processus/carte | Comparaison à l'annotation | ≥ 0,85 |

Les quatre premières sont **bloquantes** : en dessous, le système ne part pas en
production, quelle que soit la qualité perçue des réponses.

### 2.2 Recherche — **métriques de diagnostic**

Elles ne constatent aucun succès produit. Elles répondent à une seule question :
*quand une réponse est mauvaise, est-ce la recherche ou la rédaction ?*

| Métrique | Définition | Seuil v1 |
|---|---|---|
| `recall@8` | Le passage attendu est-il dans le top-8 transmis au modèle ? | ≥ 0,90 |
| `recall@50` | …dans le top-50 avant rerank ? | ≥ 0,97 |
| `MRR@8` | Rang moyen inverse du premier passage correct | ≥ 0,75 |

Lecture : réponse mauvaise **et** `recall@8` bon ⇒ le problème est dans le prompt
ou le modèle. Réponse mauvaise **et** `recall@50` mauvais ⇒ le problème est dans
le découpage ou l'embedding, et aucun réglage de prompt n'y changera rien.

### 2.3 Performance et coût

| Métrique | Seuil |
|---|---|
| TTFT p50 / p95 | < 1,5 s / < 2,5 s |
| Réponse complète p95 | < 6 s |
| Latence lookup exact p95 | < 300 ms |
| Coût moyen par question | < 0,03 € |
| Taux de lecture de cache (`cache_read_input_tokens > 0`) | > 0,9 des requêtes |

---

## 3. Le juge

- Modèle : `claude-opus-5` — un juge moins capable que le système jugé ne mesure rien.
- **Une dimension par appel** (fidélité, puis justesse) : les grilles multi-critères en un
  seul appel produisent des notes corrélées et peu discriminantes.
- Sortie structurée stricte (`output_config.format`) : note + justification courte + les
  affirmations problématiques citées.
- **Calibration obligatoire** : 30 exemples notés à la main, comparés au juge. Accord
  attendu ≥ 0,8. Un juge non calibré déplace le problème sans le résoudre.
- Coût d'une exécution complète (150 questions × 2 dimensions) : ~1 à 2 $.

---

## 4. Exécution

```
ascocid eval run    --split validation --sortie runs/2026-09-15-a/
ascocid eval compare runs/2026-09-15-a runs/2026-09-12-b
ascocid eval report  runs/2026-09-15-a --html
```

Chaque exécution enregistre : la configuration complète (modèle, effort, top-k, taille de
chunk, version des adaptateurs, hash du corpus), les résultats par question, et les
métriques agrégées. **Une exécution non reproductible ne compte pas.**

`compare` affiche les régressions par question, pas seulement les moyennes : une moyenne
stable peut cacher 10 % d'amélioration et 10 % de dégradation, et ce sont les dégradations
qui font perdre la confiance des utilisateurs.

Pour la construction du jeu et les boucles d'amélioration itérative, les commandes
`/claude-api build-eval` et `/claude-api hillclimb` fournissent une méthode outillée
(interview de construction, split, budget mesuré, état sur disque).

---

## 5. Intégration continue

| Déclencheur | Ce qui tourne | Blocant ? |
|---|---|---|
| Chaque commit | Unitaires, contrats de port, import-linter | oui |
| Chaque commit | Non-régression d'extraction sur les 10 logigrammes annotés | oui |
| Chaque commit | Assertion de lecture de cache (spec 05 §3) | oui |
| Chaque PR touchant recherche/prompt | Évaluation sur `validation` (~2 $) | avertissement |
| Avant chaque mise en production | Évaluation complète sur `test` | oui, sur les 4 seuils bloquants §2.1 |
| Après chaque ingestion nocturne | Invariants I1–I7 (spec 02 §6) + rapport d'ingestion | oui |

---

## 6. Boucle d'amélioration continue

1. Les retours 👎 (spec 07 §5) sont triés **chaque semaine**.
2. Les cas reproductibles rejoignent le jeu d'or, catégorie appropriée, split `train`.
3. Une hypothèse d'amélioration est formulée **avant** de coder (« augmenter le
   chevauchement améliorera le rappel sur les questions multi-sections »).
4. Un seul changement à la fois, mesuré sur `validation`.
5. Ce qui passe est vérifié sur `test` au jalon suivant.

Le jeu d'or est un actif vivant : il devrait doubler dans les six premiers mois d'usage
réel. S'il ne bouge pas, c'est que personne ne regarde les retours.
