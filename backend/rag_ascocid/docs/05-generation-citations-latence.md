# Spec 05 — Génération, citations et latence

> Le modèle ne sert qu'à **formuler** et **rattacher**. Il n'apporte aucune connaissance
> propre : tout ce qu'il affirme doit venir des passages fournis. Cette contrainte est la
> raison d'être des citations natives, et le critère d'acceptation principal (spec 08).

---

## 1. Choix des modèles

⚠️ **D1** — sous l'hypothèse d'un accès autorisé à l'API Claude.

| Usage | Modèle | Justification |
|---|---|---|
| **Réponse à l'utilisateur** | `claude-opus-5` | Qualité de synthèse et fidélité aux sources ; c'est le seul endroit où l'utilisateur voit le résultat. 1 M de contexte, mais on n'en utilisera que quelques milliers de tokens. |
| **Contextualisation des chunks** (ingestion, en lot) | `claude-haiku-4-5` | Tâche mécanique à très fort volume, hors ligne. |
| **Extraction des logigrammes** (cas E, ingestion) | `claude-opus-5` | Raisonnement visuel ; un modèle plus faible fusionne les étapes et invente des flèches (spec 03 §5.2). |
| **Repli cartouche qualité** (ingestion) | `claude-haiku-4-5` | Extraction courte et structurée. |
| **Juge d'évaluation** | `claude-opus-5` | Un juge plus faible que le système jugé n'a pas de valeur. |

Tarifs de référence (API Claude, par million de tokens) : Opus 5 — 5 $ entrée / 25 $
sortie ; Haiku 4.5 — 1 $ / 5 $. Lectures de cache ≈ 0,1× l'entrée ; écritures 1,25×
(TTL 5 min). Message Batches : −50 %.

**Leviers de latence, dans l'ordre à essayer** :

1. `output_config.effort: "medium"` (voire `"low"`) sur le chemin « factuelle » — c'est le
   levier le plus efficace, et il réduit aussi le coût ;
2. streaming systématique (le TTFT est ce que l'utilisateur ressent, pas la durée totale) ;
3. prompt caching (§3) ;
4. **fast mode** en dernier recours : `speed: "fast"` (bêta `fast-mode-2026-02-01`, endpoint
   `client.beta.messages`), jusqu'à ~2,5× de débit en sortie, au tarif 10 $/50 $. À
   n'activer que si les mesures montrent que le temps de génération, et non le TTFT, est le
   problème — ce qui est peu probable pour des réponses de 300–600 tokens.

> Le passage à `claude-sonnet-5` (2 $/10 $) diviserait le coût par 2,5. C'est une décision
> de compromis qualité/coût qui appartient au projet, pas à l'architecture : le jeu
> d'évaluation (spec 08) permet de la trancher sur mesure plutôt que sur intuition. Les
> deux modèles sont interchangeables par configuration.

---

## 2. Structure du prompt

Ordre imposé — du plus stable au plus volatil. C'est ce qui rend le cache exploitable
(§3) : `tools` → `system` → `messages`.

```
system (figé, jamais interpolé)
 ├─ rôle et périmètre
 ├─ règles de réponse (§4)
 ├─ format de citation attendu
 └─ [point de coupure cache #1]

system (semi-figé, change à chaque réindexation)
 ├─ carte des processus AsCoCid (liste des processus, logigrammes, codes documentaires)
 ├─ glossaire métier
 └─ [point de coupure cache #2]

messages[0] user
 ├─ documents cités  (blocs `document`, citations activées)   ← varie par requête
 ├─ contexte structuré issu du graphe (spec 04 §8)            ← varie par requête
 ├─ historique de conversation                                 ← varie
 └─ question
```

Points d'attention :

- **rien de dynamique dans `system`** : pas de date du jour, pas d'identifiant de session,
  pas de nom d'utilisateur. Ces éléments vont dans `messages`, sinon tout le préfixe est
  invalidé à chaque requête ;
- la **carte des processus** est le gros morceau caché : quelques milliers de tokens,
  identiques pour tous les utilisateurs, réécrits une fois par nuit. Elle donne au modèle
  la vision d'ensemble qu'aucun passage récupéré ne contient ;
- l'historique de conversation et la question sont **après** le dernier point de coupure.

---

## 3. Prompt caching

| Paramètre | Valeur | Raison |
|---|---|---|
| Points de coupure | 2 explicites (fin de chaque bloc système) | Maximum 4 ; deux frontières de stabilité suffisent |
| TTL | `ephemeral` 5 min (défaut) | Le trafic interactif se maintient largement au-dessus du seuil ; le TTL 1 h coûte 2× en écriture pour rien |
| Minimum cachable | 512 tokens sur Opus 5 | La carte des processus dépasse largement ce seuil ; le bloc système « règles » seul pourrait ne pas l'atteindre — vérifier |
| Caching automatique (top-level) | **désactivé** | Le prompt se termine par du contenu unique à chaque requête : le point de coupure automatique se placerait après, ce qui ne produit que des écritures jamais relues |

**Assertion de non-régression obligatoire** (test d'intégration) : deux requêtes
consécutives avec le même préfixe ⇒ la seconde a `usage.cache_read_input_tokens > 0`.

C'est la panne la plus coûteuse et la plus silencieuse du système : tout continue de
fonctionner, seule la facture change. Elle survient typiquement des mois après la mise en
service, quand quelqu'un ajoute un champ dynamique dans le prompt système.

À surveiller aussi : le total réel d'entrée est
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens` — lire `input_tokens`
seul donne une image fausse.

---

## 4. Citations

On utilise le **mécanisme de citations natif** de l'API, pas un balisage inventé dans le
prompt. Chaque passage récupéré est transmis comme bloc `document` avec
`citations: {enabled: true}` (activé sur **tous** les blocs ou aucun).

La réponse revient alors découpée en plusieurs blocs `text` ; ceux qui s'appuient sur une
source portent un tableau `citations` contenant `cited_text`, `document_index`,
`document_title` et une localisation typée :

| Type de localisation | Cas | Ce qu'on en fait |
|---|---|---|
| `page_location` (`start_page_number` / `end_page_number`, base 1) | PDF transmis en entier | lien profond `…/doc.pdf#page=N` |
| `char_location` (`start_char_index` / `end_char_index`) | texte brut | surlignage dans la visionneuse |
| `content_block_location` | document à contenu personnalisé (nos chunks) | remontée directe au `Chunk` → `Bloc` → page + bbox |

Le troisième cas est le nôtre : en transmettant chaque chunk comme document à contenu
structuré, on obtient une citation **au bloc près**, que le modèle de données (spec 02)
sait retraduire en `document + indice + page + étape`.

### 4.1 Contrainte à connaître

**Les citations sont incompatibles avec les sorties structurées** (`output_config.format`)
— la combinaison est rejetée. La réponse à l'utilisateur est donc du texte + citations ;
tout besoin de JSON strict (extraction en ingestion, §spec 03) se fait sur des appels
séparés, où les citations ne servent pas. Cette séparation est structurante : ne pas
essayer de faire produire au modèle un JSON de réponse *et* des citations dans le même
appel.

### 4.2 Ce qui est affiché

Chaque affirmation citée devient un élément cliquable portant :

```
PR-QUA-012 · indice C · p. 3 · étape 4 « Contrôle réception »
```

Trois destinations depuis cet élément : le PDF à la bonne page, le logigramme avec l'étape
surlignée, la fiche document. Voir spec 07 §3.

---

## 5. Règles de réponse (contenu du prompt système)

Ces règles sont le contrat de sûreté du système. Elles sont testées explicitement (spec 08).

1. **Ne jamais affirmer sans source.** Chaque élément factuel provient des passages
   fournis.
2. **Dire qu'on ne sait pas.** Si les passages ne permettent pas de répondre, le dire
   clairement et proposer le processus ou le document le plus proche. Une abstention
   correcte vaut mieux qu'une réponse plausible.
3. **Ne jamais inventer de référence documentaire.** Aucun code, aucun indice, aucun numéro
   de page qui ne figure pas dans les passages fournis.
4. **Signaler les divergences.** Si deux passages se contredisent, l'indiquer et citer les
   deux, sans arbitrer.
5. **Répondre en français**, dans le vocabulaire du référentiel (reprendre les termes
   exacts des documents, ne pas les paraphraser en langage courant).
6. **Rester bref.** 3 à 8 phrases par défaut ; une liste quand la réponse est une suite
   d'étapes. La réponse longue est une réponse qui n'a pas été comprise.
7. **Situer dans le processus** quand l'information de graphe est disponible : nommer
   l'étape et le logigramme.

---

## 6. Paramètres d'appel

```python
resp = client.messages.stream(
    model="claude-opus-5",
    max_tokens=2048,
    system=[
        {"type": "text", "text": REGLES,     "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": carte_proc, "cache_control": {"type": "ephemeral"}},
    ],
    thinking={"type": "adaptive"},
    output_config={"effort": "medium"},        # cf. §1, levier de latence n°1
    messages=[{"role": "user", "content": [*docs_cites, *contexte_graphe, question]}],
)
```

- **Streaming systématique** — y compris quand la réponse est courte : c'est le TTFT que
  l'utilisateur perçoit.
- `thinking: {type: "adaptive"}` — laisser le modèle décider ; ne pas désactiver la
  réflexion sur Opus 5 (effets de bord documentés : fuite de balises internes, appels
  d'outils écrits en texte). Pour aller plus vite, baisser `effort`, pas désactiver
  `thinking`.
- `display` du bloc de réflexion : `omitted` par défaut — inutile de l'exposer ici.
- Fallback en cas de refus : activer `fallbacks` côté serveur pour ne jamais renvoyer une
  page blanche à un utilisateur (un corpus qualité peut contenir des sujets — sécurité,
  produits chimiques, incidents — qui déclenchent un classifieur).

---

## 7. Budget de latence de bout en bout

| Poste | p50 | p95 |
|---|---:|---:|
| Recherche complète (spec 04 §9) | 145 ms | 410 ms |
| TTFT Claude (préfixe caché, effort `medium`) | ~1,0 s | ~1,8 s |
| **TTFT perçu** | **~1,2 s** | **~2,2 s** |
| Génération 400 tokens en streaming | ~2,5 s | ~4,0 s |
| **Réponse complète** | **~3,7 s** | **~6,2 s** |
| Chemin « lookup exact » (sans LLM) | **< 150 ms** | **< 300 ms** |

Objectifs contractuels : **TTFT p50 < 1,5 s**, **réponse complète p95 < 6 s**, mesurés à
chaque exécution du jeu d'évaluation et affichés dans le rapport.

---

## 8. Coût

Ordre de grandeur, à recalculer avec les volumes réels de la Phase 0.

**Par question** (chemin « factuelle », préfixe caché) :
entrée ≈ 6 000 tokens dont ~4 500 en lecture de cache, sortie ≈ 400 tokens
→ ≈ **0,018 $** (~0,017 €).
À 500 questions/jour : ≈ **9 $/jour**, soit ~200 $/mois.
Le chemin « lookup exact » est gratuit (aucun appel LLM) et devrait capter une part
significative du trafic.

**Ingestion initiale** (hypothèse D5 médiane : 10 000 pages, 30 000 chunks, 150 schémas
dont 100 en cas E) :

| Poste | Estimation |
|---|---|
| Contextualisation (Haiku 4.5, cache + batch) | ~15–30 $ |
| Extraction VLM des schémas (Opus 5, batch) | ~40–80 $ |
| Repli cartouche | ~5 $ |
| **Total** | **~60–115 $, une fois** |

Les réindexations incrémentales ne retouchent que le delta : coût mensuel négligeable.
Ces chiffres sont à confirmer par une **mesure sur 100 documents réels** avant de lancer
l'ingestion complète (jalon J3, spec 09).
