# Spec 11 — Le sens des schémas

> Sur les pages de procédé d'AsCoCid, la connaissance est **dans le dessin** :
> l'ordre des étapes, ce qui passe de l'une à l'autre, les branches, les
> boucles, les causes d'échec. L'ingestion ne lisait que le texte des pages :
> à « Quelles étapes suivent l'extraction du jus ? », l'assistant répondait que
> le Livre ne traitait pas la question. Ces schémas sont désormais transcrits,
> et leurs passages sont cités comme le reste.

## 1. Pourquoi le dessin échappait à l'ingestion

- Le schéma est un SVG chargé dans une balise `<object>` : l'extraction HTML ne
  le voit pas.
- Le texte de la page se limite aux liens des zones cliquables, dans un ordre
  qui n'est pas celui du procédé (« Récolte » y arrive neuvième).
- Le SVG lui-même (un export Inkscape d'un PDF) livre une centaine de
  fragments de texte dans le désordre, souvent coupés (« Etape », « post »,
  « - », « conditionnement »), et des flèches qui ne disent pas quels blocs
  elles relient.
- Pire : la carte du corpus envoyée au modèle reliait les zones par des
  flèches **dans cet ordre faux** — un enchaînement inexact présenté comme tel.
- Le graphe d'influence de la clarification haute n'a **aucune** zone
  cliquable : tout son contenu était absent.

## 2. Décision : transcrire, plutôt que reconstruire automatiquement

Une reconstruction géométrique des flèches est possible mais fragile, et ses
erreurs sont silencieuses : un enchaînement faux, présenté comme sûr, est le
pire défaut pour un outil d'aide à la décision. Or il n'y a que 13 schémas, et
ils changent rarement. Chacun est donc **transcrit une fois**, dans un fichier
versionné, puis **relu par l'IFPC**.

Le menu d'accueil (`MENU_D_ACCUEIL`) n'est pas transcrit : c'est une page de
navigation, ses zones donnent déjà ses rubriques.

## 3. Les fichiers — `config/schemas/<CODE>.toml`

```toml
idoc = 1014                       # fiche AsCoCid du schéma
code = "PROCESS_FABRICATION_GENERAL"
titre = "Diagramme général d'élaboration"
svg_sha256 = "d4e1…"              # empreinte du SVG transcrit
relecture = ""                    # « Nom, date » une fois relu par l'IFPC

[[etapes]]                        # un bloc bleu du schéma
id = "extraction"
libelle = "Extraction des moûts"  # libellé du schéma, tel quel
fiche = 1016                      # fiche détaillée (zone cliquable)
variantes = ["Extraction avec rémiage", "Extraction sans rémiage"]
intrants = []                     # ajouté à l'étape : « Calcium », « Pectinases »
groupe = ""                       # cadre englobant : « Méthode FR (fermentation ralentie) »
synonymes = ["extraction du jus"] # pour la recherche seulement, jamais montrés au modèle

[[transitions]]                   # une flèche
de = "extraction"                 # vide : entrée du schéma
vers = "clarification_mouts"      # vide : sortie du schéma
produit = "Moûts bruts"           # le cadre jaune sur la flèche
condition = ""                    # écrite sur le schéma, ou lisible sans ambiguïté
retour = false                    # true pour une boucle (« en cas de re-croissance »)

[[rattachements]]                 # liens en pointillés
etapes = ["extraction"]
nature = "coproduit"              # ou « annexe »
libelle = "Valorisation des coproduits"
elements = ["Marc vert", "Marc épuisé"]

[[chaines]]                       # graphe d'influence : causes → effets
contexte = "Cause d'échec de la clarification haute classique"
maillons = ["Mauvais état sanitaire", "Présence de polygalacturonase", "…"]
```

Conventions de transcription :

- **Rien d'inventé.** Une condition n'est écrite que si elle figure sur le
  schéma, ou se lit sans ambiguïté (une bifurcation entre deux cadres
  « Clarification haute » / « Clarification basse »). Un trait au sens
  illisible n'est pas transcrit, et le fichier le signale en commentaire.
- **Une opération dessinée à côté de la ligne principale, avec un retour sur
  celle-ci, est facultative** : on la transcrit par une flèche qui la contourne.
  Le texte produit l'indique alors par « (selon le cas) ».
- **Les boucles sont déclarées** (`retour = true`) : deviner laquelle des
  flèches d'un cycle est le retour se trompe.
- Le chargement **refuse** une transcription incohérente (étape inconnue,
  doublon) : `tests/test_schemas.py` charge tous les fichiers en CI.

## 4. Ce qui est indexé

`application/ingestion/schemas.py` produit, pour chaque schéma, des passages
de type `schema`, rattachés à sa fiche (donc cités, et ouverts sur le schéma) :

| Passage | Contenu |
|---|---|
| Enchaînement des étapes | Toutes les étapes dans l'ordre du procédé, avec variantes, intrants et produits |
| Une étape | Ce qui la précède et ce qu'elle en reçoit, ce qui la suit, les conditions ; dans un schéma d'ensemble, toute la suite jusqu'à la fin ; annexes et coproduits |
| Place dans le schéma englobant | Sur un schéma de détail (« Extraction des moûts ») : ce qui précède et suit cette étape dans le diagramme général |
| Chaîne de causes | Graphe d'influence : « A, qui entraîne : B, qui entraîne : C » |

L'ordre est un tri topologique (boucles déclarées écartées). Une étape est dite
« selon le cas » si l'une de ses étapes précédentes rejoint l'une de ses
suivantes sans y passer — question locale, qui reste juste dans un schéma à
méthodes parallèles (la fermentation primaire est obligatoire dans la
méthode FR, même si la méthode FI s'en passe).

La **carte du corpus** du prompt prend l'ordre réel des schémas transcrits, et
ne relie plus par des flèches les zones d'un schéma non transcrit.

## 5. Mise à jour

- **Au démarrage du service**, les passages des schémas sont resynchronisés si
  les transcriptions (ou la façon de les rédiger, `VERSION_REDACTION`) ont
  changé : il suffit de déployer. Seuls ces passages sont vectorisés, en
  quelques secondes.
- **`ingest indexer`** les inclut dans la reconstruction complète.
- **Schéma modifié dans AsCoCid** : si le SVG collecté n'a plus l'empreinte
  transcrite, le service et `ingest indexer` le signalent. Relire le schéma,
  mettre à jour le fichier et son `svg_sha256`.

## 6. Mesure

Sur le vrai corpus, avec le vrai modèle E5, pour « Quelles étapes suivent
l'extraction du jus ? » : avant, aucun des 8 passages envoyés au modèle ne
parlait de la suite du procédé ; après, les deux passages qui y répondent sont
aux rangs 1 et 2. Six autres questions dépendant des schémas (clarification
basse, causes d'échec de la gélification, méthode FI, validation de
l'assemblage, conditionnement en fût) passent de 0 à 2 ou 3 passages de schéma
dans les 8.

## 7. À relire par l'IFPC

Chaque fichier porte `relecture = ""` tant qu'il n'est pas relu. Points
d'attention :

- `PROCESS_CLARIFICATION_MOUT` : un trait relie le soutirage de la
  clarification haute par flottation à la centrifugation de la clarification
  basse ; non transcrit, son sens n'étant pas lisible.
- `PROCESS_ASSEMBLAGE` : les conditions de la validation (« si l'assemblage test
  n'est pas validé » / « une fois validé ») sont la lecture du losange de
  décision, non un texte du schéma.
- `PROCESS_FABRICATION_GENERAL` : les moûts bruts vont aussi directement à la
  fermentation (tracé de gauche), lecture confirmée par le schéma de l'étape
  fermentaire (« moûts à fermenter (clarifiés ou non) »).
