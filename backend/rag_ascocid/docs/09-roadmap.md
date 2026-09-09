# Spec 09 — Roadmap, effort et risques

> Principe de séquencement : **prouver la valeur sur un périmètre étroit avant d'élargir**.
> Un RAG qui répond parfaitement sur un processus est un produit ; un RAG qui répond
> médiocrement sur trente est un prototype qu'on abandonne.

Estimations en jours-homme pour **1 développeur**, hors délais d'obtention des accès.

---

## Jalons

### J0 — Cadrage et accès · 2 j

| Livrable | Critère de sortie |
|---|---|
| Accès à AsCoCid obtenus (lecture, éventuel partage réseau) | Un `curl` / un `ls` fonctionne |
| Décision **D1** tranchée (confidentialité / API Claude) | Écrite et validée par le responsable des données |
| Sponsor métier identifié, 5–8 utilisateurs disponibles pour les entretiens | Créneaux posés |
| Dépôt git initialisé, `uv` installé, squelette de la spec 06 | `pytest` passe à vide |

> **C'est le seul jalon avec un prérequis externe bloquant.** Le lancer en premier, en
> parallèle de tout le reste.

### J1 — Analyse d'AsCoCid · 4–6 j · **spec 01**

| Livrable | Critère de sortie |
|---|---|
| `ascocid-probe` : crawl, classify, graph, report | Inventaire exhaustif du périmètre |
| `docs/rapport-phase0.md` | Toutes les questions de la spec 01 §1 ont une réponse chiffrée |
| Typologie d'encodage des schémas | Chaque schéma rattaché à un cas A–F |
| 10 logigrammes annotés à la main | Format cible, réutilisables en CI |
| 30–60 questions utilisateurs verbatim | Collectées en entretien |
| **D2–D6 tranchées** | Consignées dans le README |
| Modèle de données révisé | Spec 02 mise à jour au vu du réel |

**Point de décision.** Si les schémas sont majoritairement en cas F (sources natives
disponibles), J2 se réduit d'environ 60 %. S'ils sont tous en cas E, J2 double et la revue
humaine devient un poste de charge à budgéter.

### J2 — Extraction et modèle canonique · 8–12 j · **specs 02, 03**

| Livrable | Critère de sortie |
|---|---|
| Collecte + normalisation + stockage adressé par contenu | Ingestion rejouable, incrémentale |
| Parsing documentaire (Docling + OCR) | ≥ 95 % des documents produisent des blocs exploitables |
| Extraction des logigrammes, tous cas présents | ≥ 90 % de concordance avec les 10 schémas annotés |
| Base SQLite peuplée, invariants I1–I7 verts | `ascocid ingest --verifier` passe |
| Rapport d'ingestion | Toutes les métriques de la spec 03 §8 sous leurs seuils |

### J3 — Indexation et recherche · 6–8 j · **spec 04**

| Livrable | Critère de sortie |
|---|---|
| Chunking structuré + contextualisation (mesurée sur 100 documents d'abord) | Coût réel confirmé avant l'ingestion complète |
| BGE-M3 + Qdrant hybride + FTS5 + rerank | `recall@8 ≥ 0,90` sur le jeu `validation` |
| Routage d'intention, filtres, expansion graphe | `recall_exact = 1,00` ; latence de recherche p95 < 410 ms |
| Arbitrage GPU/CPU | Décidé sur mesures réelles |

**Ce jalon est le cœur technique du projet.** Ne pas passer à J4 tant que `recall@8` n'est
pas atteint : améliorer la génération sur de mauvais passages est du temps perdu.

### J4 — Génération, API, interface · 6–8 j · **specs 05, 07**

| Livrable | Critère de sortie |
|---|---|
| Assemblage du prompt + prompt caching vérifié | `cache_read_input_tokens > 0` en test |
| Citations natives mappées vers document/indice/page/étape | Exactitude des citations ≥ 0,95 |
| API SSE conforme à la spec 07 §2 | TTFT p50 < 1,5 s mesuré |
| Interface avec panneau schéma et surlignage d'étape | Un utilisateur non formé trouve une information sans aide |

### J5 — Évaluation, durcissement, pilote · 5–7 j · **spec 08**

| Livrable | Critère de sortie |
|---|---|
| Jeu d'or complet (100–150 questions), juge calibré | Accord juge/humain ≥ 0,8 |
| CI complète | Tous les tests bloquants verts |
| Déploiement (podman compose), ingestion nocturne, bascule d'alias | Une réindexation complète tient en une nuit |
| **Pilote sur 1–2 processus, 5–10 utilisateurs, 2 semaines** | Les 3 seuils bloquants de la spec 08 §2.1 sont tenus |

### J6 — Élargissement · itératif

Extension progressive du périmètre, processus par processus. Chaque extension repasse le
jeu d'évaluation : un corpus qui grandit **dégrade** le rappel si rien n'est ajusté, et
c'est la mesure qui le révèle, jamais l'impression d'usage.

---

## Récapitulatif

| Jalon | Effort | Cumul |
|---|---:|---:|
| J0 Cadrage | 2 j | 2 j |
| J1 Analyse | 5 j | 7 j |
| J2 Extraction | 10 j | 17 j |
| J3 Recherche | 7 j | 24 j |
| J4 Génération + UI | 7 j | 31 j |
| J5 Évaluation + pilote | 6 j | 37 j |

**≈ 37 jours-homme jusqu'au pilote**, soit ~8 semaines à 1 ETP, ~5 semaines à 1,5 ETP
(J2 et J3 se parallélisent partiellement).

Fourchette selon le résultat de J1 : **28 j** (schémas en cas F, corpus propre) à **55 j**
(tout en cas E, pas de nomenclature de version fiable).

Budget API sur la période : **~150–250 $** (ingestion + mises au point + évaluations),
cf. spec 05 §8.

---

## Risques

| # | Risque | Prob. | Impact | Signal précoce | Mitigation |
|---|---|---|---|---|---|
| R1 | **Accès à AsCoCid non obtenus à temps** | moyenne | bloquant | J0 dépasse 3 j | Seul prérequis dur : le lancer avant tout le reste, escalader à J+3 |
| R2 | **Pas de règle fiable « document en vigueur »** | moyenne | **élevé** | J1, question spec 01 §1.4 sans réponse | Problème de gouvernance, pas technique. Remonter au propriétaire du référentiel. En attendant : `statut = inconnu` ⇒ exclusion de l'index, et le dire |
| R3 | Schémas 100 % en images plates (cas E) | moyenne | élevé | J1 `classify` | Chercher les fichiers sources auprès des auteurs avant d'accepter la voie VLM ; sinon budgéter la revue humaine |
| R4 | `recall@8` plafonne sous 0,90 | moyenne | élevé | J3 | Diagnostic par `recall@50` : si bon ⇒ reranking ; si mauvais ⇒ chunking/embedding. Leviers dans l'ordre : contextualisation, taille de chunk, modèle d'embedding |
| R5 | Latence hors budget | faible | moyen | J4 | Ordre des leviers : `effort`, cache, routage vers la voie exacte, GPU, fast mode |
| R6 | **Adoption faible malgré une qualité correcte** | moyenne | **élevé** | Pilote J5 | La cause est presque toujours la confiance, pas la vitesse. Traitement : citations irréprochables, abstention franche, retour au schéma. C'est la raison d'être des specs 05 §5 et 07 §4 |
| R7 | Corpus beaucoup plus volumineux que prévu | faible | moyen | J1 inventaire | Réduire le périmètre v1 à 1–2 processus |
| R8 | Régression silencieuse du prompt caching | **élevée** dans la durée | moyen (coût) | `cache_read_input_tokens = 0` | Assertion en CI dès J4, surveillance du champ `usage` en production |
| R9 | Dérive du référentiel après mise en service (nouveaux formats, réorganisation) | élevée | moyen | Rapport d'ingestion nocturne | Les seuils de la spec 03 §8 alertent avant que les utilisateurs ne le constatent |

---

## Ce qui ferait échouer le projet

Trois causes, par ordre de fréquence observée sur ce type de système :

1. **Sauter la Phase 0** et vectoriser directement le texte des PDF. Le résultat fonctionne
   en démonstration, perd toute la structure processus/étape, et devient indéfendable dès
   la première question de traçabilité.
2. **Ne pas mesurer.** Sans jeu d'or, chaque modification est un pari, et les régressions
   passent inaperçues jusqu'à ce que les utilisateurs cessent d'utiliser l'outil — sans le
   dire.
3. **Citer un document périmé.** Un seul cas visible suffit à détruire la confiance dans un
   référentiel qualité. D'où le statut de version comme champ de premier ordre (spec 02 §3)
   et un seuil bloquant à **zéro** (spec 08 §2.1).
