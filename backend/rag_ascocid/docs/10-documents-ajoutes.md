# Spec 10 — Documents ajoutés par les administrateurs

> Les administrateurs de PADOC ajoutent des documents (PDF, Word) à l'assistant
> depuis l'onglet **Administration → Documents de l'assistant**, sans
> redéploiement ni release. Le document est trouvable par l'assistant quelques
> secondes après l'envoi, et cité comme « Document IFPC ».

## 1. Décisions

| Question | Décision |
|---|---|
| Formats | **PDF texte et Word (.docx).** Pas d'OCR : un PDF scanné est refusé avec un message qui le dit, plutôt qu'indexé vide. L'ancien `.doc` est refusé (à enregistrer en `.docx` ou PDF). |
| Publication | **Immédiate.** Seuls les administrateurs peuvent ajouter ; leur envoi vaut publication. Le retrait est immédiat lui aussi. |
| Confidentialité | **Documents publics uniquement.** Les passages partent au modèle de langage (ARGO ou Gemini), comme ceux d'AsCoCid. Le fichier d'origine est servi sans jeton. |
| Citations | **Origine visible.** Une source porte `provenance: "document"` et renvoie vers le fichier, jamais vers une page AsCoCid qui n'existe pas. |
| Taille | 25 Mo par fichier. |

## 2. Où vivent les documents

```
<ASCOCID_DATA>/documents/
├── registre.json          ← source de vérité : titre, état, auteur, empreinte
└── fichiers/1000000.pdf   ← fichier d'origine, nommé par son identifiant
```

La base SQLite et l'index vectoriel n'en sont qu'une **projection**. C'est ce
qui permet à `ingest extraire`, qui vide la base avant de la reconstruire
depuis AsCoCid, de ne rien perdre : il réinjecte les documents du registre, et
`ingest indexer` les vectorise avec le reste.

Les identifiants partent de **1 000 000** ; les fiches AsCoCid sont numérotées
entre 1 000 et 2 000.

**Sauvegarde :** le dossier `documents/` est sur le même volume que le corpus
(`/opt/padoc/donnees/ascocid` sur la VM). Sauvegarder ce dossier suffit.

## 3. Cycle d'un document

1. **Envoi** (`POST /api/ldc/documents?nom=…&titre=…`, corps = le fichier brut).
   Le fichier est lu **dans la requête** : format, texte présent, doublon
   (même empreinte SHA-256). Un refus répond `422` avec la raison, et rien
   n'est écrit.
2. **Intégration** en tâche de fond (un seul ouvrier, les envois s'enchaînent) :
   sections reconstituées → blocs → passages (`decouper`, le même découpage
   qu'AsCoCid) → FTS5 + vecteurs E5 → ajout **à chaud** dans l'index en
   mémoire → recalcul de la carte du corpus du prompt. État `en_cours` puis
   `pret` (ou `erreur`). Mesuré : 0,4 s pour une note de deux pages, environ
   une seconde de lecture pour un rapport de 70 pages, plus le calcul des
   vecteurs.
3. **Retrait** (`DELETE /api/ldc/documents/{idoc}`) : registre, fichier, base,
   FTS5 et index vectoriel, sous le même verrou que l'intégration — un retrait
   demandé pendant une intégration attend sa fin, puis l'annule.

Un service arrêté au milieu d'une intégration la reprend au démarrage.

## 4. Lecture des fichiers

`infrastructure/parsing/document.py`.

- **PDF (PyMuPDF)** : une ligne nettement plus grande que le corps du texte
  (×1,15), courte et sans ponctuation finale est un titre de section. Les
  lignes de bord de page répétées sur plus de la moitié des pages (en-têtes,
  pieds, numéros) sont écartées ; une phrase répétée *dans* le corps du texte
  est conservée. Les césures de fin de ligne sont recollées.
- **Word (python-docx)** : les styles « Titre » / « Heading » délimitent les
  sections ; les tableaux sont gardés à leur place, une ligne par rangée
  (`Étape | Température`), parce que c'est souvent là qu'est la valeur cherchée.
- **Titre** : celui saisi par l'administrateur, sinon les métadonnées du
  fichier, sinon le premier intitulé, sinon le nom du fichier.

## 5. Accès

| Route | Accès |
|---|---|
| `GET/POST /api/ldc/documents`, `DELETE /api/ldc/documents/{idoc}` | Jeton du Core API avec `role = ROLE_ADMIN` ; `403` sinon |
| `GET /api/ldc/document/{idoc}/fichier` | Public (lien ouvert dans un nouvel onglet, sans jeton) |
| `GET /api/ldc/fiche/{idoc}` | Inchangé ; porte désormais `provenance` |

Sans `JWT_SECRET` (développement), comme pour `/ask`, tout est ouvert.

## 6. Et la release GitHub ?

Elle ne sert qu'à **amorcer un volume vide sur Railway**, qui n'atteint pas
ascocid.fr (`amorcer`, `ASCOCID_ARCHIVE_URL`). Ajouter un document ne demande
**aucune release** : le volume est persistant, sur la VM comme sur Railway. La
release ne redevient utile que pour recréer un volume de zéro ; une archive
faite après des ajouts contient alors aussi `documents/`.

## 7. Limites connues

- Pas d'OCR (décision §1).
- La détection des titres d'un PDF est une heuristique : une erreur ne coûte
  qu'un intitulé de section moins précis dans la citation.
- Sans index vectoriel chargé (mode dégradé), un document ajouté n'est trouvé
  que par la recherche lexicale, jusqu'au prochain `ingest indexer`.
