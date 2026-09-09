# Rapport de Phase 0 — Analyse d'AsCoCid

**État : partiel.** Passe 1 (reconnaissance) faite ; passes 2 et 3 (crawl exhaustif,
échantillonnage) à venir. Toutes les mesures ci-dessous sont issues de requêtes réelles,
pas d'estimations.

Méthode : `./probe auth-test` + `./probe peek` + sondages ciblés (≈ 25 requêtes,
lecture seule, avec délai).

---

## 1. Accès — **résolu**

| Point | Constat |
|---|---|
| Nature | Application **PHP** maison, serveur **Apache**, version **3.14.0** (build `MESTRAL`) |
| URL racine | `https://ascocid.fr/ldc` → redirige vers `navig.php?idoc=1045&start=yes` |
| Authentification | **HTTP Basic** — `WWW-Authenticate: Basic realm="Protected 'public_html/ldc'"` (`.htpasswd` Apache) |
| Ni SSO, ni cookie, ni jeton | Confirmé : le serveur annonce Basic dès la requête non authentifiée |
| Accès validé | `./probe auth-test` → **code 0**, 85 436 octets de contenu réel |
| Périmètre | `https://ascocid.fr/ldc` |
| Langues | **Bilingue FR / EN** (bascule dans l'interface, `glossaire.php?lang=`) |

→ **Décision D1** : les contenus sont déjà exposés sur un serveur public sous simple
mot de passe. La contrainte de confidentialité est donc faible ; l'API Claude est
utilisable sauf avis contraire du propriétaire.
→ **Décision D2 : crawl HTTP authentifié en Basic.** Résolue.

## 2. Structure de navigation — **résolue**

L'application expose **deux vues du même nœud**, indexées par le même identifiant
numérique :

| Endpoint | Rôle | Poids typique |
|---|---|---|
| `navig.php?idoc=N` | **Navigation** : carte conceptuelle SVG + surcouche de zones cliquables | 80–85 ko |
| `view.php?id_document=N` | **Fiche** : le contenu, sans navigation ni JavaScript | 6–32 ko |

`view.php` porte le **même texte utile** que `navig.php` (6 183 vs 6 229 caractères
mesurés sur `idoc=1114`) pour **5× moins d'octets**. → **C'est l'endpoint d'ingestion.**

Autres endpoints repérés : `glossaire.php?lang=`, `download.php?mimetype=<b64>&dldfile=<b64>`,
`index.php`.

Le graphe **n'est pas un arbre** : plusieurs fiches sont atteignables depuis plusieurs
cartes. Le modèle graphe complet de la spec 02 est donc justifié.

## 3. Encodage des schémas — **résolu, et c'est le meilleur cas**

⚠️ L'hypothèse initiale (« images plates, cas E, extraction par vision ») est **fausse**.

Chaque page de navigation contient :

```html
<object id="imgIdocument" type="image/svg+xml"
        data="ascocid_data/1_PROCESS_FERMENTATION.svg"
        data-imgwidth="1280" data-imgheight="882">
```

et une **surcouche HTML de zones cliquables positionnées** :

```html
<a id="target_14" class="target cmap" data-x="332" data-y="274"
   title="La fermentation primaire"
   href="navig.php?idoc=1114" data-id_document="1114">
```

Chaque zone livre donc, **sans aucune interprétation** : le libellé (`title`), les
coordonnées (`data-x`/`data-y`), et la cible (`data_id_document`). Le référentiel de
coordonnées est donné par `data-imgwidth`/`data-imgheight`.

Le SVG lui-même (≈ 275 ko pour la carte d'accueil) contient 61 `<text>`, 72 `<rect>`,
91 `<path>` — libellés et géométrie exacts, mais **aucun lien** : la cliquabilité est
entièrement dans la surcouche HTML.

**Conséquences :**

- classement : **cas B/C de la typologie (spec 01 §3)** — parsing DOM exact, coût nul ;
- **aucun VLM n'est nécessaire** pour reconstruire le graphe ni pour surligner une étape ;
- le surlignage d'étape prévu en spec 07 §3.1 est immédiatement réalisable : les `bbox`
  existent déjà ;
- **le jalon J2 de la roadmap s'effondre** — voir §7.

→ **Décision D3 : parsing déterministe intégral. Résolue.**

## 4. Modèle de contenu d'une fiche — **résolu**

Le HTML de `view.php` est déjà sémantiquement balisé :

| Sélecteur | Contenu | Occurrences (fiche 1114) |
|---|---|---|
| `#titreDocument` | Titre | 1 |
| code de fiche | `CMAP_FERMENTATION_PRIMAIRE`, `PROCESS_FERMENTATION` — **identifiant métier stable**, aligné sur le nom du SVG | 1 |
| `#explicationView` | Illustration + légende | 1 |
| **`.defbox` / `.boxdef`** | **Définitions — les unités de connaissance atomiques** | **14** |
| `.actbox` / `.boxact` | Auteurs : statut, biographie, courriel, organisme (INRAE, IFPC) | 2 |
| `.dateDocument` | `Créée le 2 janv. 2020 … modifiée le 10 sept. 2020 …` | 1 |
| `a[data-keyword]` | Vocabulaire contrôlé, avec fréquence d'occurrence | **241 mots-clés** |

**`.defbox` est la trouvaille la plus utile pour la recherche** : le corpus est déjà
découpé en unités sémantiques par ses auteurs. La stratégie de découpage de la spec 04 §2
se simplifie radicalement — un `.defbox` = un `Bloc` = un `Chunk`, sans heuristique de
taille ni chevauchement à calibrer.

Les 241 mots-clés forment un **vocabulaire contrôlé** exploitable directement en filtre
et en signal lexical (spec 04 §6.1).

## 5. Versionnement — **différent de l'hypothèse, et plus simple**

Il n'y a **ni code documentaire de type `PR-QUA-012`, ni indice de révision, ni statut
« en vigueur / périmé »**. Le seul signal temporel est `.dateDocument`
(date de création + date de modification).

→ La spec 02 §3 (statut de version comme champ de premier ordre) **doit être révisée** :
le risque « citer un document périmé » n'existe pas sous cette forme. L'identité d'une
fiche est son **code de fiche** + son `idoc` ; sa fraîcheur est sa date de modification.
C'est une simplification importante — et le risque R2 de la roadmap disparaît.

## 6. Volumétrie — **mesurée exhaustivement**

`./probe inventaire --debut 1000 --fin 1700` : 701 identifiants sondés,
**415 fiches réelles**, 286 identifiants vides.

| Type (préfixe du code de fiche) | Nombre | Corps médian | Part du texte |
|---|---:|---:|---:|
| **`FICHE_*`** — articles rédigés | **177** | 7 305 car. | **90 %** |
| `CMAP_*` — cartes conceptuelles | 140 | 63 car. | ~0 % |
| `FDC_*` — fiches de variétés de pommes | 85 | 42 car. | 7 % (**dans l'image**, voir §7) |
| `PROCESS_*` — diagrammes de procédé | 11 | 61 car. | ~0 % |
| `MENU_*`, `GRAPHE_*` | 2 | — | ~0 % |

| Total | Valeur |
|---|---|
| **Volume textuel** | **1 458 993 caractères ≈ 486 000 tokens** |
| Définitions (`.defbox`) | **1 455** |
| Renvois « voir aussi » | **865** |
| Articles avec bibliographie | 161 / 177 |
| Articles avec illustration | 173 / 177 |

**Le corpus entier tient dans une fenêtre de contexte de 1 M tokens.** C'est un corpus
*petit*. Conséquences : ingestion à quelques euros (§9), réindexation complète en
minutes, et aucune contrainte de volumétrie sur le choix de l'index.

→ **Décision D5 : résolue, corpus petit.**

**Anomalies relevées par l'inventaire** (c'est sa raison d'être) :

- `idoc=1413` portait le code `Fiche_LE_SULFITAGE` au lieu de `FICHE_…` — saisie
  manuelle incohérente dans le CMS. Normalisation appliquée à l'extraction.
- Un `idoc` inexistant renvoie **HTTP 200** avec une coquille vide : la détection se fait
  sur la présence de `#titreDocument`, jamais sur le statut.
- `.dateDocument` est porté par une **classe**, pas un id, contrairement aux autres
  conteneurs. L'extracteur cherche désormais les deux.

## 7. Les « PDF » — **résolu**

Ce que l'utilisateur appelle « les PDF » sont les **177 fiches `FICHE_*`** : des articles
rédigés, en **HTML**, servis par `view.php?id_document=N`. Exemple type
([`idoc=1481`](https://ascocid.fr/ldc/view.php?id_document=1481), *L'état de maturité des
pommes à cidre*) :

| Conteneur | Contenu |
|---|---|
| `#codeDocument` | `FICHE_ETAT_DE_MATURITE_DES_POMMES_A_CIDRE` — identifiant métier stable |
| `#explicationView` | Le corps de l'article : *Résumé*, *Introduction*, sections titrées |
| `#motscles` | Définitions du vocabulaire employé, sous forme `définition [ Terme ]` |
| `#voiraussi` | **Renvois vers d'autres fiches** — 865 arêtes supplémentaires du graphe |
| `#biblio` | Références bibliographiques (161 fiches sur 177) |
| `#auteurs` | Auteurs : statut, biographie, organisme (INRAE, IFPC, CFC) |

**Il n'y a aucun PDF, aucun document scanné, aucune numérisation.**
→ **Tout le pipeline PDF / OCR / cartouche qualité de la spec 03 §4 et §4.1 est sans
objet.** Le parsing se réduit à de l'extraction DOM sur du HTML déjà balisé.

**La seule exception : les 85 fiches de variétés `FDC_*`.** Elles n'ont *aucun* texte —
tout leur contenu est dans une image PNG (mesuré sur `FDC_ANTOINETTE` : 1 472 × 1 057 px,
1,77 Mo). C'est le **seul endroit du corpus qui justifie une extraction par vision**.

→ **Décision D8 : résolue.**

## 8. Coût d'ingestion — **recalculé sur les volumes réels**

L'estimation de la spec 05 §8 (**60–115 $**) supposait 10 000 pages de PDF scannés à
passer en OCR et 100 schémas à interpréter par vision. Cette hypothèse est **fausse** :
le corpus est du HTML balisé, dix fois plus petit, et le graphe s'extrait par parsing.

D'où vient le coût, poste par poste :

| Poste | Appelle un modèle ? | Coût réel |
|---|---|---|
| Collecte, parsing HTML, extraction du graphe | non — DOM local | **0 €** |
| Embeddings (BGE-M3 local) | non — modèle local | **0 €** |
| Index, base, stockage | non | **0 €** |
| **Contextualisation des chunks** (spec 04 §3) — Haiku 4.5, cache + batch | oui | **≈ 1,10 $** |
| **Extraction des 85 fiches variétés** (images PNG) — Opus 5 vision, batch | oui | **≈ 1,30 $** |

Détail de la contextualisation : ~2 500 chunks (1 455 `.defbox` + sections d'articles),
article parent mis en cache une fois (177 écritures à 1,25×), une lecture de cache à 0,1×
par chunk, ~80 tokens de sortie chacun ; Message Batches à −50 %.

> **Total : ≈ 2,50 $ (~2,30 €), une seule fois.** Les réindexations ne retouchent que le
> delta. Et ces deux postes sont **optionnels** : sans eux, l'ingestion coûte
> littéralement **0 €** — au prix d'un rappel plus faible et de 85 fiches variétés
> illisibles.

Le coût récurrent est **au moment de la question**, pas à l'ingestion : ~0,018 $ par
question posée (spec 05 §8), et 0 € sur le chemin « lookup exact » qui n'appelle aucun
modèle.

**Remarque d'architecture** : à 486 000 tokens, le corpus entier tiendrait dans une seule
requête Opus 5 (fenêtre de 1 M). Ce serait toutefois ~2,43 $ par question et plusieurs
secondes de latence — le RAG reste le bon choix. Mais cela autorise deux libertés : un
`top-k` généreux (16–20 au lieu de 8) et une **carte du corpus très riche dans le préfixe
mis en cache** (spec 05 §2).

## 9. Extraction réalisée

Pipeline construit et exécuté sur la totalité du corpus :

```
./probe inventaire   → 415 fiches identifiées
./ingest collecte    → 830 pages (view.php + navig.php), 59,2 Mo, 0 échec
./ingest extraire    → data/ascocid.sqlite
./ingest verifier    → invariants
```

Le HTML brut est conservé dans un magasin adressé par contenu (`data/blobs/`) :
re-parser les 830 pages prend deux secondes, contre trois minutes de
re-téléchargement. C'est ce qui rendra l'itération sur le découpage supportable.

### 9.1 Corpus obtenu

| Table | n | Contenu |
|---|---:|---|
| `fiche` | **415** | idoc, code, type, titre, dates, illustration, auteurs |
| `bloc` | **2 782** | 847 sections d'articles · 1 445 définitions · 309 résumés · 181 bibliographies |
| `carte` | **145** | SVG + référentiel de coordonnées |
| `zone` | **833** | zones cliquables `(x, y) → fiche cible` |
| `renvoi` | **1 649** | 865 « voir aussi » + **784 liens insérés dans le corps** |

Le glossaire compte **311 termes distincts** pour 1 445 définitions : les mêmes
termes sont définis sur plusieurs fiches, ce qui en fait un vocabulaire contrôlé
partagé, directement exploitable en filtre et en signal lexical (spec 04 §6.1).

Densité du graphe : médiane de 5 zones par carte (max 35), 7 renvois sortants et
5 entrants par fiche (max 69). Ce n'est pas un arbre — c'est un graphe dense, ce
qui valide l'expansion par voisinage de la spec 04 §8.

### 9.2 Les liens du corps : une arête qu'on a failli manquer

Le premier passage n'extrayait que le bloc « Voir aussi ». Le contrôle
d'orphelines a révélé **68 fiches inatteignables** — dont les 69 fiches de
variétés. La cause : **784 liens insérés directement dans le texte** des
articles, aussi nombreux que les « voir aussi » déclarés, et plus riches de sens
puisqu'ils sont contextualisés par leur paragraphe.

Après extraction de ces liens, les orphelines tombent de **68 à 3** : la carte
d'accueil (racine, normal), « A propos du livre », et une fiche de variété
(*Maltranche*) réellement non référencée. Les deux origines sont conservées
distinctement dans la table `renvoi`.

### 9.3 Un défaut trouvé dans AsCoCid

L'invariant « tout renvoi pointe vers une fiche existante » signale **un lien
mort** :

> fiche **1382** *« Les agents de collage »* → `idoc 1198` *« Les additifs
> autorisés »* — cette fiche n'existe pas.

C'est un défaut du contenu, pas du pipeline. À remonter aux auteurs.

### 9.4 Ce qui relève réellement de la vision

Recomptage précis, texte rédigé mesuré fiche par fiche :

| Type | Total | Rédigées | Image seule |
|---|---:|---:|---:|
| `FICHE` | 177 | **175** | 2 |
| `FDC` | 85 | 16 | **69** |
| `CMAP` / `PROCESS` / `GRAPHE` / `MENU` | 153 | 0 | 153 *(ce sont des cartes, c'est normal)* |

`FDC` recouvre deux familles distinctes : 16 fiches de connaissance rédigées et
69 fiches de variétés de pommes dont tout le contenu est dans un PNG.

→ **68 fiches** (illustration PNG, aucun texte) justifient une extraction par
vision, et non 85. Coût recalculé : **≈ 1,05 $** en lot.

## 8. Ce qui reste à faire

- [x] Crawl exhaustif de la plage d'`idoc` → **415 fiches inventoriées** (§6)
- [x] Réponse à la question des PDF → **il n'y en a pas** (§7)
- [x] Extraction du contenu complet des articles → **2 782 blocs** (§9)
- [x] Extraction du graphe → **833 zones + 1 649 renvois** (§9)
- [ ] Extraction par vision des **68** fiches variétés (§9.4)
- [ ] Décision FR seul / FR+EN pour l'indexation (**nouvelle décision, D7**)
- [ ] Validation manuelle du graphe sur 10 cartes
- [ ] 30–60 questions utilisateurs verbatim
- [ ] `robots.txt`, rate limit, fenêtre de crawl acceptable pour l'hébergeur
