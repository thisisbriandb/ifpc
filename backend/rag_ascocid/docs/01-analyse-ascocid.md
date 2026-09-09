# Spec 01 — Analyse d'AsCoCid (Phase 0)

> **Principe** : on ne vectorise pas un corpus qu'on ne comprend pas. Toute la qualité du
> RAG dépend de la fidélité avec laquelle on reconstruit le graphe
> `Processus → Logigramme → Étape → Document`. Ce graphe existe déjà dans AsCoCid,
> encodé d'une manière ou d'une autre. La Phase 0 consiste à **trouver comment**, et à
> décider si on peut le récupérer par parsing (gratuit, exact) ou s'il faut le
> reconstruire par vision (coûteux, approximatif).

**Durée cible : 4 à 6 jours.** Aucune ligne de code d'indexation n'est écrite avant la fin.

---

## 1. Questions auxquelles cette phase doit répondre

Chaque question a une réponse **écrite et sourcée** dans le rapport final. Une question
sans réponse est un risque reporté en production.

### 1.1 Accès et périmètre

- [ ] Quelle est la nature technique d'AsCoCid ? (site statique, CMS — lequel, SharePoint,
      GED métier, application maison, simple arborescence de fichiers exposée ?)
- [x] **Une authentification est requise, et les accès sont disponibles.** Reste à
      déterminer : la nature exacte du mécanisme (§4.5), l'URL racine, l'existence
      d'un rate limit, d'un `robots.txt`, d'une API ou d'un export.
- [ ] Existe-t-il un accès **direct au système de fichiers** derrière le site ? (Si oui, on
      court-circuite le crawl : plus rapide, plus fiable, et on récupère les dates de
      modification réelles.)
- [ ] Quel est le périmètre exact ? Tout le site, ou un sous-ensemble (un domaine, un
      référentiel) ?
- [ ] Y a-t-il des zones à accès restreint ? (→ décision **D4**)

### 1.2 Structure de navigation

- [ ] À quoi ressemble le « tableau » d'entrée : table HTML, cartographie image, menu,
      page de liens ?
- [ ] Combien de niveaux entre l'entrée et un PDF ? (entrée → macro-processus → logigramme
      → étape → document ? ou plus court / plus long ?)
- [ ] Le graphe est-il un arbre ou un vrai graphe (un document rattaché à plusieurs
      étapes / plusieurs processus) ? **Cette réponse conditionne le modèle de données
      (spec 02).**
- [ ] Y a-t-il des liens transverses (renvois entre procédures, « voir aussi ») ?

### 1.3 Encodage des schémas — **le point critique**

- [ ] Sous quelle forme technique chaque logigramme est-il publié ? (voir §3, la
      typologie et sa stratégie d'extraction associée)
- [ ] Les **fichiers sources** des schémas existent-ils quelque part ? (`.vsdx`, `.vsd`,
      `.drawio`, `.pptx`, `.bpmn`, `.graphml`) → **c'est le jackpot**, cf. §3 cas F.
- [ ] Les zones cliquables portent-elles un identifiant d'étape exploitable, ou seulement
      une URL de destination ?
- [ ] Les schémas encodent-ils des **couloirs / acteurs** (swimlanes) ? Des conditions
      (losanges) ? Des entrées/sorties ?
- [ ] Un même logigramme existe-t-il en plusieurs versions/millésimes en ligne ?

### 1.4 Corpus documentaire

- [ ] Combien de fichiers, quelle répartition par type et par taille ? (→ décision **D5**)
- [ ] Part de PDF **texte** vs **image scannée** — la mesure, pas l'impression.
- [ ] Existe-t-il une nomenclature de référence (`PR-…`, `MO-…`, `FO-…`, `EN-…`) ? Où est
      elle inscrite : nom de fichier, cartouche en en-tête/pied de page, métadonnées PDF,
      base annexe ?
- [ ] Comment est portée la **version / l'indice de révision** ? Comment sait-on qu'un
      document est **en vigueur** vs **périmé** ? *(Sans réponse à cette question, le RAG
      citera tôt ou tard un document obsolète — défaut bloquant.)*
- [ ] Y a-t-il des doublons, des fichiers orphelins (non liés depuis un schéma), des liens
      morts ?
- [ ] Les documents contiennent-ils des tableaux structurés importants ? des formulaires ?

### 1.5 Usage réel

- [ ] Qui sont les utilisateurs, et **quelles questions posent-ils réellement** ?
      → collecter **30 à 60 questions verbatim** auprès de 5–8 utilisateurs. C'est la
      graine du jeu d'évaluation (spec 08) et le seul garde-fou contre un système
      techniquement correct mais inutile.
- [ ] Quelles recherches échouent aujourd'hui, et pourquoi ?
- [ ] Quel est le coût actuel d'une recherche (temps, ressenti) ? → base de comparaison.

---

## 2. Méthode

Trois passes, dans cet ordre. Ne pas paralléliser : chaque passe informe la suivante.

### Passe 1 — Reconnaissance manuelle (½ journée)

Deux personnes, navigateur ouvert, **outils de développement activés**. On parcourt 5 à 10
chemins complets entrée → PDF, et on note pour chacun :

- l'URL de chaque niveau,
- le HTML de la zone cliquable (**c'est là que se joue le cas §3**),
- le format du fichier terminal,
- tout ce qui ressemble à un identifiant stable.

Livrable : 10 chemins documentés, captures incluses. C'est peu, mais c'est ce qui oriente
tout le reste — 10 exemples réels valent mieux qu'une architecture déduite d'un schéma
d'intention.

### Passe 2 — Sonde automatisée (2 jours)

Le script `ascocid-probe` (§4) parcourt le site en lecture seule et produit un inventaire
exhaustif. Il ne parse pas les contenus : il **cartographie**.

### Passe 3 — Échantillonnage et validation (1–2 jours)

Sur un **échantillon stratifié** de 30 à 50 documents et 10 logigrammes couvrant tous les
cas rencontrés :

- test d'extraction réel avec les outils envisagés (spec 03),
- mesure du taux de réussite par catégorie,
- annotation manuelle de la vérité terrain pour ces 10 logigrammes (= jeu de test
  d'extraction, réutilisé en CI).

---

## 3. Typologie d'encodage des schémas et stratégie d'extraction

C'est la table de décision centrale de la Phase 0. Pour chaque logigramme rencontré,
on classe dans un des cas suivants.

| Cas | Signature à chercher dans le HTML/fichier | Ce qu'on récupère | Stratégie | Coût |
|---|---|---|---|---|
| **A. Table / liste HTML** | `<table>`, `<ul>` avec `<a href>` | Libellés + cibles, ordre | Parse DOM (`selectolax`/`lxml`) | ~0 |
| **B. Image + imagemap** | `<img usemap>` + `<map><area shape coords href>` | Libellé (`alt`/`title`), **coordonnées**, cible | Parse `<area>` ; les coords donnent la position → recoupement avec l'OCR de l'image pour le libellé | faible |
| **C. SVG cliquable** | `<svg>` inline ou objet, avec `<a xlink:href>`, `<text>`, `<path>` | **Tout** : texte, géométrie, liens, souvent les flèches | Parse XML : `<text>` = libellés, `<path>`/`<line>` = arêtes, `<a>` = documents | faible |
| **D. PDF avec liens** | Annotations `/Link` dans le PDF | Rectangles cliquables + destinations | `PyMuPDF` : `page.get_links()` + `page.get_text("dict")` pour le texte sous le rectangle | faible |
| **E. Image matricielle plate** | `<img src="*.png\|jpg">` sans map, ou export aplati | Rien de structuré | **VLM** (Claude vision) → extraction en JSON structuré ; revue humaine | élevé |
| **F. Fichier source disponible** | `.vsdx`, `.vsd`, `.drawio`, `.pptx`, `.bpmn`, `.graphml` | **Tout, exactement** : formes, texte, connecteurs, couloirs, hyperliens | Parse XML natif (`.vsdx`/`.pptx`/`.drawio` = ZIP+XML ; `.bpmn` = XML) | faible |

**Règle de priorité : F > C > D > B > A > E.** Si le cas F est disponible ne serait-ce que
pour une partie du corpus, le chercher activement vaut plusieurs semaines de travail
d'extraction. Demander explicitement aux propriétaires du site : *« où sont les fichiers
qui ont servi à fabriquer ces images ? »*

> ⚠️ **HYPOTHÈSE (à confirmer)** : les logigrammes AsCoCid sont majoritairement en cas B ou
> E (image publiée). Les specs 03 et 09 chiffrent l'effort sous cette hypothèse. Si le cas
> F domine, le jalon J2 de la roadmap se réduit d'environ 60 %.

### 3.1 Recoupement systématique

Quel que soit le cas, on applique le même contrôle : le **nombre d'étapes extraites** et le
**nombre de documents liés** doivent correspondre à ce que voit un humain sur le schéma. Le
jeu de 10 logigrammes annotés à la main (passe 3) sert de référence permanente.

---

## 4. Outil : `ascocid-probe`

Un CLI en lecture seule, jetable mais versionné, qui ne produit que des fichiers de rapport.
**Il n'écrit rien sur AsCoCid et ne suit aucun lien sortant du périmètre.**

### 4.1 Commandes

```
ascocid-probe crawl   --root <url|chemin> --out data/probe/   # parcours + inventaire
ascocid-probe classify --in data/probe/                        # typologie §3 par schéma
ascocid-probe graph    --in data/probe/                        # reconstruction du graphe de liens
ascocid-probe sample   --in data/probe/ --n 50                 # échantillon stratifié
ascocid-probe report   --in data/probe/ --out docs/rapport-phase0.md
```

### 4.2 Livrables du crawl

| Fichier | Contenu |
|---|---|
| `inventaire.parquet` | 1 ligne / ressource : `url`, `type_mime`, `taille`, `sha256`, `last_modified`, `profondeur`, `parents[]`, `http_status` |
| `liens.parquet` | 1 ligne / arête : `source_url`, `cible_url`, `type_lien` (nav / imagemap / svg / pdf-annot / texte), `libelle`, `coords` |
| `schemas.json` | 1 entrée / schéma détecté : URL, cas §3, nb de zones cliquables, dimensions, hash |
| `types.csv` | Répartition par extension × taille × profondeur |
| `anomalies.csv` | Liens morts, orphelins (aucun parent), doublons de `sha256`, boucles, ressources > 50 Mo |
| `pdf_profil.csv` | Par PDF : nb pages, ratio caractères extractibles / page, présence d'images pleine page, polices intégrées → **classe `texte` / `mixte` / `scanné`** |

### 4.3 Détection texte vs scanné (règle appliquée par `classify`)

```python
# heuristique, calibrée sur l'échantillon de la passe 3
import fitz  # PyMuPDF

def profil_pdf(chemin: str) -> dict:
    doc = fitz.open(chemin)
    pages = []
    for page in doc:
        texte = page.get_text("text")
        images = page.get_images(full=True)
        aire_img = sum(
            (r := page.get_image_bbox(img)).width * r.height
            for img in images
            if page.get_image_bbox(img)
        )
        pages.append({
            "chars": len(texte.strip()),
            "ratio_image": aire_img / (page.rect.width * page.rect.height or 1),
        })
    med_chars = sorted(p["chars"] for p in pages)[len(pages) // 2]
    med_img = sorted(p["ratio_image"] for p in pages)[len(pages) // 2]
    if med_chars < 50 and med_img > 0.6:
        classe = "scanne"        # OCR obligatoire
    elif med_chars < 400:
        classe = "mixte"         # OCR de complément sur les pages pauvres
    else:
        classe = "texte"         # extraction directe
    return {"pages": len(pages), "classe": classe, "med_chars": med_chars}
```

Le seuil `50 / 400` est un point de départ : il est **recalibré** sur l'échantillon annoté
de la passe 3, et la valeur retenue est consignée dans le rapport.

### 4.4 Garde-fous du crawler

- Concurrence limitée (≤ 4 requêtes simultanées), délai entre requêtes, `User-Agent`
  identifiable, respect de `robots.txt`.
- Périmètre strict par préfixe d'URL ; aucun suivi hors domaine.
- Reprise sur incident : journal append-only, ressources déjà vues sautées par `sha256`.
- **Aucune écriture, aucun POST, aucun formulaire soumis.**
- Les identifiants d'accès viennent de l'environnement, jamais du code.

---

### 4.5 Authentification

**Confirmé** : AsCoCid est derrière une authentification, et les accès sont disponibles.

#### Règle de manipulation des secrets

Les identifiants ne transitent **jamais** par un chat, un ticket, un commit, un message
ou un fichier de configuration versionné. Ils vivent dans un `.env` local, hors dépôt
(`.gitignore`), en permissions `600`, et sont lus par le code via l'environnement
uniquement. `ConfigAcces.__repr__` masque les champs sensibles pour qu'un `print` de
debug ou une trace d'erreur ne les recopie pas dans un log.

#### Modes pris en charge

| `ASCOCID_AUTH` | Cas d'usage | Variables |
|---|---|---|
| `none` | Site ouvert / VPN seul | — |
| `basic` | HTTP Basic / Digest | `ASCOCID_USER`, `ASCOCID_PASSWORD` |
| `bearer` | Jeton porteur, clé d'API standard | `ASCOCID_TOKEN` |
| `header` | Clé d'API dans un en-tête maison | `ASCOCID_HEADER_NAME`, `ASCOCID_HEADER_VALUE` |
| `cookie` | **SSO (SAML / ADFS / Azure AD)** — session copiée du navigateur | `ASCOCID_COOKIE` |
| `form` | Formulaire de connexion → cookie de session | `ASCOCID_LOGIN_URL`, `ASCOCID_USER`, `ASCOCID_PASSWORD`, `ASCOCID_FORM_*` |
| `mtls` | Certificat client | `ASCOCID_CLIENT_CERT`, `ASCOCID_CLIENT_KEY` |

Réseau interne : `ASCOCID_CA_BUNDLE` (autorité de certification d'entreprise) et
`ASCOCID_PROXY` couvrent les cas courants. Ne désactiver `ASCOCID_VERIFY_TLS` qu'en
dernier recours.

#### Le piège du SSO — pourquoi `auth-test` existe

Derrière un SSO, **une session invalide ne produit aucune erreur HTTP**. Le serveur
répond `200 OK` avec la page de connexion. Un crawler naïf collecte alors des milliers
de copies du formulaire de login, les indexe, et le défaut ne se manifeste qu'à la
première question posée au RAG — des semaines plus tard.

`diagnostiquer()` inspecte donc quatre signaux à chaque réponse :

1. le statut (`401`/`403`) ;
2. l'URL finale et la chaîne de redirections (`/adfs/`, `SAMLRequest`, `/login`, …) ;
3. le `<title>` de la page ;
4. la présence d'un `<input type=password>` ou d'un jeton SAML/ADFS dans le corps.

Ce contrôle n'est pas réservé à `auth-test` : il s'applique à **chaque réponse du
crawl**, car une session expire en cours de route. Un taux de pages diagnostiquées
« mur d'authentification » supérieur à 0 % interrompt le crawl.

#### Procédure

```bash
cp .env.example .env && chmod 600 .env
$EDITOR .env                 # ASCOCID_ROOT_URL, ASCOCID_AUTH, et le bloc correspondant

./probe auth-test            # ← à lancer avant toute autre chose
./probe peek <url-page-entree>
./probe peek <url-d-un-logigramme>
```

`auth-test` sort en code 1 tant que le contenu réel n'est pas atteint, et affiche une
aide ciblée sur le mode configuré. `peek` classe la page dans la typologie du §3 et
enregistre le HTML brut pour inspection.

#### Si le SSO ne se scripte pas

Le mode `cookie` (session copiée depuis `F12 → Réseau → En-têtes de requête → Cookie`)
couvre l'immense majorité des SSO d'entreprise. Sa limite est l'expiration : quelques
heures à quelques jours. Deux options si le crawl complet ne tient pas dans une session :

1. **Découper le crawl** en tranches reprenables (le journal append-only le permet
   déjà) et renouveler le cookie entre deux tranches ;
2. **Playwright** : une connexion interactive unique, `storage_state.json` persisté et
   rejoué. Nécessite une installation supplémentaire — à n'engager que si l'option 1
   se révèle insuffisante.

Si un **accès direct au partage de fichiers** existe, il rend tout ce paragraphe sans
objet et reste l'option à privilégier (spec 03 §2).


## 5. Livrables de fin de phase

1. **`docs/rapport-phase0.md`** — réponse écrite à chacune des questions du §1, chiffres à
   l'appui.
2. **Les fichiers d'inventaire** (§4.2), archivés et horodatés.
3. **`docs/02-modele-de-donnees.md` mis à jour** — le modèle canonique, révisé au vu du
   réel (le graphe est-il un arbre ? un document a-t-il plusieurs parents ?).
4. **10 logigrammes annotés à la main** au format cible → jeu de test d'extraction.
5. **30–60 questions utilisateurs verbatim** → graine du jeu d'or (spec 08).
6. **Décisions D1–D6 tranchées** et consignées dans le README.
7. **Une décision d'architecture d'extraction** : pour chaque cas §3 présent dans le
   corpus, l'outil retenu et le taux de réussite mesuré sur l'échantillon.

## 6. Critères de sortie

La phase est terminée quand **tous** ces points sont vrais :

- [ ] 100 % des ressources du périmètre sont inventoriées et classées.
- [ ] Chaque schéma est rattaché à un cas de la typologie §3.
- [ ] Le graphe de liens est reconstruit et **validé manuellement sur 10 chemins complets**.
- [ ] Le taux de PDF scannés est mesuré (pas estimé).
- [ ] La règle qui détermine « document en vigueur » est écrite et vérifiée sur 20 exemples.
- [ ] Les décisions D1–D6 sont tranchées.
- [ ] Le jeu de 30–60 questions réelles existe.

## 7. Risques propres à cette phase

| Risque | Signal précoce | Mitigation |
|---|---|---|
| Accès non obtenu (SSO, VPN, autorisations) | Blocage dès la passe 1 | Le demander **avant** J0 ; c'est le seul prérequis dur. |
| Schémas 100 % en cas E (images plates) | `classify` ne trouve ni `<map>`, ni SVG, ni annotation | Chercher les fichiers sources (cas F) auprès des auteurs avant d'accepter la voie VLM. |
| Aucune règle de version fiable | Deux documents de même code sans indice discriminant | Remonter au propriétaire du référentiel : c'est un problème de gouvernance documentaire, pas un problème technique. Ne pas le masquer par du code. |
| Corpus beaucoup plus gros que prévu | `inventaire.parquet` > 200 k lignes | Réduire le périmètre v1 à 1–2 processus, prouver la valeur, étendre ensuite. |
| Le graphe réel est bien plus enchevêtré que le modèle « arbre » | Nombreux nœuds à parents multiples | C'est une bonne nouvelle pour le retrieval (spec 04, §6) mais impose le modèle graphe complet (spec 02). |
