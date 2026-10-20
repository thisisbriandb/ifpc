# Spec 12 — Illustrations en image : OCR, relecture, indexation

> 257 illustrations du Livre ne sont que des images PNG : les 84 fiches de
> variété (densité du jus, acidité, tanin, zones de production, sensibilité aux
> maladies…) et les figures des articles (légendes, tableaux). 69 fiches de
> variété n'avaient **aucun** texte en base. Elles sont désormais lues par OCR,
> relues par l'IFPC, et indexées.

## 1. Inventaire

| Famille | Nombre | Source du texte | Traité par |
|---|---|---|---|
| Schémas de procédé, graphe d'influence | 12 | SVG (texte exact) | transcription à la main — spec 11 |
| Cartes conceptuelles (CMAP) | 139 | SVG (texte exact) | à faire — extraction géométrique du SVG |
| **Fiches de variété (FDC)** | 84 PNG | image | **OCR — cette spec** |
| **Illustrations d'articles (FICHE)** | 173 PNG | image | **OCR — cette spec** |

## 2. Pourquoi Tesseract, et pas un modèle de vision

Essai sur trois fiches de variété (Antoinette, Argile Bruyère, Armagnac),
comparées à l'image :

| | Tesseract 5.3 | gemma3:4b (VM, Ollama) |
|---|---|---|
| Valeurs chiffrées | **17 justes sur 17** | 66 lu 68, 1062,3 lu 1060, tanin omis |
| Rangement | aucun (le code le fait) | champs décalés d'un cran |
| Mots | justes ; erreurs sur exposants et formules (« SO'H: ») | « secret » inventé, « érigé » lu « dirigé » |
| Temps | ~1 s par fiche | ~80 s par fiche |

Le modèle de vision se trompe **sans le dire** ; Tesseract se trompe peu, et
donne une confiance par mot qui permet de signaler ses doutes. `gemma3:4b`
reste installé sur la VM pour d'éventuels tris d'images, où une erreur coûte peu.

Vectoriser les images directement ne remplace pas la transcription : un
vecteur sert à retrouver, pas à répondre ; le modèle qui rédige travaille sur
du texte, et la vérification des chiffres cités compare au texte des passages.

## 3. Chaîne

```
./transcrire images         image → OCR → rubriques + « intitulé : valeur » → TOML
Administration → Relecture  image et texte côte à côte → corrigé / validé
(démarrage du service)      TOML → passages « illustration » → index, à chaud
```

- **OCR, une fois, sur un poste** où Tesseract est installé
  (`tesseract-ocr-fra`) — pas dans l'image du service.
- **Préparation de l'image** : fond blanc, agrandie ×2. Les fiches de
  variété sont des doubles pages texte | photo ; le côté du texte varie
  (9 fiches l'ont à droite), les deux moitiés sont lues et la plus riche en
  mots gardée. Une illustration d'article n'est jamais recadrée.
- **Bruit écarté** : une ligne sans mot de trois lettres ni chiffre (traits de
  tableau, taches de photo) ; une ponctuation isolée n'est pas un « mot douteux ».
- **Structuration** : rubriques (titres en capitales ou numérotés « 3.1 »),
  paires « intitulé : valeur », deux valeurs sur une ligne séparées
  (« Densité du jus : 1048,6 - Alcool en puissance : 6° 2. »), lignes coupées
  recollées. Les rubriques rédigées (observations, zones de production,
  commercialisation) restent en paragraphes. **Rien n'est converti** : « 6° 2 »
  reste « 6° 2 ».
- **Le TOML est relu juste après son écriture** : un fichier qui ne se relit
  pas à l'identique est signalé (l'OCR produit des suites de guillemets qui
  cassaient un échappement naïf).

## 4. Le fichier — `<données>/transcriptions/images/<CODE>.toml`

```toml
idoc = 1416
code = "FDC_ARMAGNAC"
titre = "Armagnac"
image_sha256 = "…"          # image transcrite
source = "ocr-tesseract 5.3.4"
qualite_ocr = 92.7          # confiance moyenne de l'OCR, 0-100
statut = "a_verifier"       # a_verifier | corrige | valide
verifie_par = ""            # posé par le serveur à la relecture
verifie_le = ""
texte_ocr = """…"""         # brut, pour la traçabilité

[[rubriques]]
titre = "QUALITES TECHNOLOGIQUES DU FRUIT"
note = "analyse de M. Tavernier le 15-12-51"

[[rubriques.lignes]]
intitule = "Densité du jus"
valeur = "1 065,5."
douteux = []                # mots à comparer à l'image
```

Les transcriptions vivent **avec les données** (le volume du corpus), pas
dans le dépôt : elles en dérivent, et la relecture les corrige sur place.
**Sauvegarder** `transcriptions/` avec le reste du volume.

`./transcrire images` ne réécrit **jamais** une transcription corrigée ou
validée ; si son image a changé dans AsCoCid, il le signale. Un fichier
illisible n'est pas écrasé non plus.

## 5. Relecture — Administration → « Relecture des illustrations »

Réservée au rôle ADMIN. L'image d'origine à gauche, le texte extrait à droite,
modifiable ; les lignes dont l'OCR doute sont encadrées, leurs mots listés,
avec « Vérifié » pour lever le doute. Deux enregistrements :

- **Corrigée** : les corrections sont prises, les doutes non levés restent ;
- **Validée** : tout a été comparé à l'image, plus aucun doute.

Dans les deux cas l'auteur et la date sont posés par le serveur d'après le
jeton, et **seuls les passages de cette fiche** sont revectorisés (une
seconde). Ce qui vient de l'OCR (empreinte de l'image, texte brut) n'est pas
modifiable.

## 6. Indexation

Un passage par rubrique, type `illustration`, rattaché à la fiche (donc cité,
et ouvert sur la fiche et son image), la source (« Comité des Fruits à Cidre…,
Edition 1963 ») rappelée en fin de passage.

**Décision de l'équipe : une transcription « à vérifier » est indexée tout de
suite**, sauf si sa qualité de lecture est sous **75/100** : un tableau aux
colonnes mélangées (« Éliminer les matières Rinçage du matériel à ») dégraderait
les réponses au lieu de les enrichir. Ces fiches (13 sur 257 au premier
passage, dont le tableau des pollinisations) n'entrent dans l'assistant
qu'une fois corrigées — ce sont les premières de la liste de relecture.

Synchronisation au démarrage du service si les transcriptions ont changé
(541 passages, 65 s la première fois), et dans `ingest indexer`.

## 7. Mesure

Sur le vrai corpus, vrai modèle E5, cinq questions sur des variétés (densité
d'Argile Bruyère, zones d'Antoinette, sensibilité à la tavelure, tanin de
l'Armagnac, acidité du Blanchet) : avant, **aucun** passage utile dans les 8
envoyés au modèle ; après, la fiche de la variété au **premier rang** à chaque
fois.

## 8. Limites

- Les **tableaux** sont mal lus par l'OCR : ils demandent une saisie à la
  relecture.
- Les **exposants et formules** (1ʳᵉ-2ᵉ, SO⁴H²) sont les erreurs typiques : ils
  sont signalés comme douteux.
- **Railway** n'a pas d'accès shell : les transcriptions y arrivent avec
  l'archive du volume (spec 07 §0), puis sont relues en ligne.
