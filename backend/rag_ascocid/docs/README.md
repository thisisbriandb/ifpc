# RAG AsCoCid — Spécifications

> Système de question/réponse sur le **livre de connaissances AsCoCid** : cartographie de
> processus, logigrammes cliquables, et le corpus documentaire (PDF, images, textes) rattaché
> à chaque étape.

## 1. Le problème

AsCoCid fonctionne aujourd'hui comme un **arbre de navigation** :

```
Tableau d'entrée  →  clic sur un lien  →  schéma / logigramme  →  clic sur une étape  →  PDF
```

Ce modèle est correct pour *parcourir*, mauvais pour *chercher*. Pour retrouver une
information ponctuelle (« quel formulaire pour une non-conformité fournisseur ? »,
« qui valide l'étape 4 ? »), l'utilisateur doit re-parcourir tout le chemin à chaque fois,
de mémoire, puis ouvrir et lire un PDF. Le coût de recherche est payé **à chaque question**,
et il augmente avec la taille du corpus.

## 2. Contexte d'intégration

**Ce projet est un backend.** Il alimente un chatbot intégré à la **plateforme
d'aide à la décision cidricole de l'IFPC**. Il ne fournit pas l'interface
utilisateur finale — il fournit une API, et des fragments de rendu que la
plateforme peut afficher telle quelle ou remplacer.

Deux conséquences immédiates :

- **« Aide à la décision » relève le niveau d'exigence.** Un producteur agira
  sur la réponse : date de récolte, sulfitage, température de cuverie. Une
  valeur inventée ne produit pas un agacement mais une décision fausse sur une
  cuve. La passe de vérification (spec 05) et l'abstention cessent d'être des
  raffinements ; elles deviennent la condition de mise en service.
- **Le dialogue est multi-tours.** Un chatbot reçoit « et pour les pommes
  douces ? » après une première question. La conception actuelle est
  mono-tour — c'est un manque réel, traité en spec 07 §8.

## 3. Ce qu'on construit

Un moteur de réponse qui **conserve la structure** au lieu de l'aplatir :

- il comprend le graphe `Processus → Logigramme → Étape → Document` ;
- il indexe le contenu textuel *et* le contenu des schémas ;
- il répond en langage naturel, **avec citations vérifiables** (document, indice de
  révision, page) ;
- il renvoie aussi **le schéma avec l'étape concernée surlignée** — l'utilisateur retrouve
  son repère visuel habituel, sans avoir refait le chemin.

Le dernier point est le cœur du produit. Un RAG qui répond « voici le texte » remplace mal
un système dont la valeur est la *traçabilité*. Un RAG qui répond « voici la réponse, elle
vient de l'étape 4 du logigramme *Réception*, procédure PR-QUA-012 indice C, page 3 »
le remplace bien.

## 4. Contraintes structurantes

| Contrainte | Conséquence sur l'architecture |
|---|---|
| **Latence** — « pas dix mille ans » | Tout ce qui peut être calculé hors-ligne l'est. Le chemin de requête ne fait que : embed → recherche → rerank → génération en streaming. Budget cible : **TTFT < 1,5 s p50**, réponse complète < 6 s p95. Voir [05](05-generation-citations-latence.md). |
| **Convivialité** | Réponse en streaming, citations cliquables, retour visuel au schéma. Pas de jargon d'outil. Voir [07](07-api-ui.md). |
| **Maintenabilité / modularité** | Architecture hexagonale, noyau métier sans dépendance à un framework RAG. Chaque brique (parseur, embedder, index, LLM) est un adaptateur remplaçable. Voir [06](06-architecture-logicielle.md). |
| **Traçabilité qualité** | On ne cite jamais sans référence documentaire + indice de révision. Une réponse issue d'un document périmé est un défaut bloquant. Voir [02](02-modele-de-donnees.md). |
| **Structure d'abord** | La phase d'analyse d'AsCoCid précède toute vectorisation. Voir [01](01-analyse-ascocid.md). |

## 5. Les specs

| # | Spec | Objet | Statut |
|---|---|---|---|
| [01](01-analyse-ascocid.md) | Analyse d'AsCoCid | Phase 0 : rétro-ingénierie du site, inventaire, encodage des schémas | **fait** — `./probe` |
| [rapport](rapport-phase0.md) | **Rapport de Phase 0** | Constats mesurés : accès, structure, encodage, volumétrie | **passe 1 faite** |
| [02](02-modele-de-donnees.md) | Modèle de données | Graphe canonique, identifiants, versions, stockage | rédigé |
| [03](03-ingestion-parsing.md) | Ingestion & parsing | Collecte, extraction structurée des cartes et des fiches | **implémenté** — `./ingest` |
| [04](04-indexation-recherche.md) | Indexation & recherche | Chunking, hybride FTS5 + dense, fusion RRF, diversité | **implémenté** — `./ingest indexer` |
| [05](05-generation-citations-latence.md) | Génération & citations | Modèles Claude, prompt caching, citations natives, budget latence | **écrit, non exécuté** — clé API requise |
| [06](06-architecture-logicielle.md) | Architecture logicielle | Hexagonale, ports/adaptateurs, stack, arborescence | rédigé |
| [07](07-api-ui.md) | API & UI | Contrats HTTP, SSE, expérience de réponse | **implémenté** — `./serve` + `frontend/app/assistant` |
| [08](08-evaluation.md) | Évaluation | Jeu d'or, métriques, non-régression | rédigé |
| [09](09-roadmap.md) | Roadmap | Jalons, effort, risques | rédigé |

Lecture minimale pour démarrer : **README → 01 → 09**.

## 6. Hors périmètre (v1)

- L'interface du chatbot elle-même : elle appartient à la plateforme IFPC.
- Édition ou publication de documents depuis l'outil (AsCoCid reste la source de vérité).
- Workflow de validation / signature électronique.
- Multilingue autre que le français.
- Réponse sur des documents que l'utilisateur n'a pas le droit de voir → voir §6, décision D4.

## 7. Décisions ouvertes

Ces points changent l'architecture ; ils sont tranchés en fin de Phase 0 (spec [01](01-analyse-ascocid.md)).
Par défaut, les specs sont écrites **sous les hypothèses de la colonne « défaut proposé »**,
et chaque endroit concerné porte un marqueur `⚠️ D<n>`.

| # | Décision | Défaut proposé dans ces specs | Impact si l'autre option est retenue |
|---|---|---|---|
| **D1** | **Confidentialité** : les documents peuvent-ils transiter par l'API Claude ? | **Contexte clarifié** : contenus exposés sur serveur public sous Basic auth ⇒ contrainte faible. API Claude retenue sauf avis du propriétaire. | Si refus → génération sur modèle local ; le reste de l'architecture est inchangé. |
| **D2** | **Mode d'accès** | ✅ **RÉSOLUE** — crawl HTTP, authentification **Basic** (Apache `.htpasswd`). Accès validé. | — |
| **D3** | **Encodage des logigrammes** | ✅ **RÉSOLUE** — SVG externe + surcouche HTML de zones positionnées (`data-x`/`data-y`/`href`). **Parsing déterministe intégral, aucun VLM.** | — |
| **D4** | **Droits d'accès** | Un seul niveau de lecture (un `.htpasswd` unique). | — |
| **D5** | **Volumétrie** | ✅ **RÉSOLUE, mesurée** — **415 fiches**, **486 000 tokens**, 1 455 définitions, 865 renvois. Le corpus entier tient dans une fenêtre de contexte. | Ingestion ≈ **2,50 $ une fois** ; réindexation complète en minutes. |
| **D6** | **Fraîcheur** | Réindexation incrémentale ; le corpus bouge peu (dates de modification 2020 sur les fiches sondées). | — |
| **D7** | **Langues** — AsCoCid est **bilingue FR/EN**. Indexer le français seul, ou les deux ? | ⚠️ **OUVERTE** — défaut proposé : FR seul en v1. | FR+EN double le volume d'index et impose un routage par langue à la requête. |
| **D8** | **Corpus PDF** | ✅ **RÉSOLUE — il n'y a aucun PDF.** Les « PDF » sont **177 articles `FICHE_*` en HTML**. Seule exception : 85 fiches de variétés `FDC_*` dont le contenu est une image PNG. | Le pipeline PDF/OCR de la spec 03 §4 disparaît ; la vision ne sert plus que pour 85 images. |

| **D9** | **Format attendu par la plateforme** : HTML prêt à afficher, ou JSON à rendre par leur front ? | ✅ **RÉSOLUE — JSON.** L'écran est une page Next.js de la plateforme (`frontend/app/assistant`) ; le rendu HTML reste l'outil d'aperçu. |
| **D10** | **Authentification** : qui sont les utilisateurs du chatbot, et comment la plateforme les identifie-t-elle ? | ✅ **RÉSOLUE** — jeton JWT de la plateforme, vérifié dès que `JWT_SECRET` est présent dans l'environnement du service. |
| **D11** | **Hébergement** : le backend tourne-t-il sur l'infrastructure IFPC, et avec quel accès réseau à ascocid.fr et à l'API du modèle ? | ✅ **RÉSOLUE — Railway**, comme le reste du backend. Image Docker + volume `/data` pour le corpus et les poids ; procédure en [07 §0](07-api-ui.md). |

**État d'avancement** : voir le [rapport de Phase 0](rapport-phase0.md) — passe 1 faite,
accès validé, structure du site élucidée.

## 8. Conventions

- Les blocs marqués `⚠️ HYPOTHÈSE` désignent une affirmation sur AsCoCid **non vérifiée**.
  Toute hypothèse doit être confirmée ou infirmée en Phase 0.
- « Document » = un PDF / une note / une image porteuse de texte publiée dans AsCoCid.
- « Étape » = un nœud d'un logigramme.
- Les identifiants métier (`PR-QUA-012`, indice `C`) sont supposés exister ; leur forme
  exacte est un livrable de la Phase 0.
