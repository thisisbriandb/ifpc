# Référentiel scientifique — Calculs de pasteurisation PADOC / IFPC

Document de référence des formules, des paramètres micro-organismes et des règles de décision appliqués par la plateforme PADOC.

**Ce document fait autorité sur le code.** Les tableaux du §4 sont lus directement par la suite de tests du moteur de calcul (`backend/tests/test_referentiel.py`) : toute divergence entre une valeur écrite ici et la valeur employée par le moteur fait échouer l'intégration continue. Modifier un paramètre scientifique se fait donc **ici**, et le code suit.

Référentiel micro-organismes en vigueur : **30/07/2026**. Voir l'historique des révisions au §7.

---

## 1. Formule du taux létal ($L$)

Le **taux létal ($L$)** (ou vitesse relative de destruction thermique) quantifie l'efficacité destructrice de la température instantanée $T$ par rapport à la température de référence $T_{\text{ref}}$ du micro-organisme cible.

$$L = 10^{\frac{T - T_{\text{ref}}}{z}}$$

* **$T$** : température mesurée ou de consigne du produit (en **°C**).
* **$T_{\text{ref}}$** : température de référence du micro-organisme (en **°C**).
* **$z$** : équivalent thermique de destruction du micro-organisme (en **°C**), soit l'élévation de température nécessaire pour réduire d'un facteur 10 la valeur $D$.

---

## 2. Calcul de la valeur pasteurisatrice ($\text{VP}$)

La **valeur pasteurisatrice ($\text{VP}$)**, exprimée en **unités de pasteurisation (UP)**, quantifie le cumul de l'effet destructeur de la chaleur tout au long du traitement thermique, selon la méthode de Bigelow.

$$\text{VP} = \int_{0}^{t} L(t) \, dt = \sum_{i=1}^{n} \left( \frac{L_{i-1} + L_i}{2} \right) \times \Delta t_i$$

### 2.1. Temps de maintien théorique

$$\text{VP} = L \times t_{\text{maintien}} \implies t_{\text{maintien}} = \frac{\text{VP}_{\text{cible}}}{L} = \frac{\text{VP}_{\text{cible}}}{10^{\frac{T - T_{\text{ref}}}{z}}}$$

Le calcul travaille en minutes. L'affichage choisit son unité en fonction de la valeur et non du procédé : au-dessus de la minute en minutes, en dessous en secondes, avec un plancher explicite « < 1 sec » — un temps très court ne doit jamais s'afficher « 0,0 », qui se lirait comme l'absence de maintien nécessaire.

### 2.2. Unité de la colonne temps

L'unité du relevé est **déclarée par l'opérateur** (minute ou seconde) et non déduite du procédé : une flash-pasteurisation peut légitimement être relevée en minutes si le relevé couvre la montée en température.

Exception : lorsque la colonne temps porte un **horodatage** (export d'enregistreur), elle est convertie en minutes dès la lecture du fichier, et la déclaration de l'opérateur ne s'y applique plus. Une double conversion diviserait la VP par 60.

---

## 3. Critère de conformité microbiologique ($k_{\text{calc}}$)

La conformité d'un barème de pasteurisation s'appuie sur le **facteur de réduction logarithmique calculé ($k_{\text{calc}}$)** de la population microbienne :

$$k_{\text{calc}} = \frac{\text{VP}}{D_{\text{ref}}}$$

* **$\text{VP}$** : valeur pasteurisatrice cumulée obtenue (en **UP**).
* **$D_{\text{ref}}$** : temps de réduction décimale du micro-organisme à la température $T_{\text{ref}}$ (en **minutes**).

### 3.1. Règle de décision (seuil de 15 log)

$$\text{Statut} = \begin{cases} \mathbf{Conforme} & \text{si } k_{\text{calc}} \ge 15{,}0 \\ \mathbf{Insuffisant} & \text{si } k_{\text{calc}} < 15{,}0 \end{cases}$$

**Fondement microbiologique.** Conforme pour un micro-organisme de référence donné, dans l'hypothèse d'une population initiale de $10^6 \text{ ufc/mL}$ avant pasteurisation et de la présence de moins de 1 micro-organisme pour $1\,000\,000$ de bouteilles après traitement thermique — soit une réduction logarithmique de 15.

Ce facteur correspond à la réduction logarithmique de la population microbienne. Un facteur de 6 équivaut à une division de la population par $10^6$.

Il en découle que la VP cible d'un micro-organisme vaut $15 \times D_{\text{ref}}$ : les deux formulations du critère sont équivalentes.

> **Provenance.** Le tableau transmis par la R&D fournit $T_{\text{ref}}$, $D_{\text{ref}}$ et $z$ — **pas la VP cible**. Les valeurs de la colonne « VP cible » du §4.1 sont dérivées par $15 \times D_{\text{ref}}$. Si la règle des 15 log venait à changer, toutes les cibles changeraient sans qu'aucune donnée transmise ne bouge.

### 3.2. Cohérence des températures de référence

$k_{\text{calc}}$ n'a de sens que si $\text{VP}$ et $D_{\text{ref}}$ se rapportent à la **même** température de référence. Lorsqu'un utilisateur expert impose un $T_{\text{ref}}$ différent de celui de la table, le $D$ est transposé avant division :

$$D(T) = D(T_{\text{ref}}) \times 10^{\frac{T_{\text{ref}} - T}{z}}$$

$k_{\text{calc}}$ est ainsi invariant par changement de température de référence, comme il doit l'être.

---

## 4. Référentiel officiel des micro-organismes et produits

Mis à jour le **30/07/2026**, d'après le tableau des micro-organismes transmis par la R&D à cette date.

La colonne « clé » donne l'identifiant technique de chaque entrée. Elle lève l'ambiguïté entre des souches homonymes (plusieurs entrées portent le nom *Saccharomyces cerevisiae*) et sert de point d'ancrage à la vérification automatique du code.

### 4.1. Paramètres des micro-organismes

| Clé | Micro-organisme | $T_{\text{ref}}$ (°C) | $D_{\text{ref}}$ (min) | $z$ (°C) | VP cible 15 log (UP) |
| :--- | :--- | ---: | ---: | ---: | ---: |
| `byssochlamys_fulva` | Byssochlamys fulva | 95.0 | 1.81 | 7.1 | 27.15 |
| `alicyclo_std` | Alicyclobacillus acidoterrestris | 95.0 | 27.80 | 16.4 | 417.00 |
| `saccharo_jus` | Saccharomyces cerevisiae | 60.0 | 22.50 | 4.0 | 337.50 |
| `saccharo_cidre` | Saccharomyces cerevisiae 1 | 60.0 | 1.10 | 4.0 | 16.50 |
| `saccharo_cidre_low` | Saccharomyces cerevisiae 2 | 60.0 | 0.40 | 4.0 | 6.00 |
| `ecoli` | Escherichia coli | 62.0 | 1.50 | 6.0 | 22.50 |
| `salmonella` | Salmonella | 62.0 | 0.49 | 6.0 | 7.35 |
| `listeria` | Listeria monocytogenes | 62.0 | 0.43 | 5.6 | 6.45 |

**Clés héritées.** `alicyclo_res` a été retirée du référentiel : elle portait les paramètres exacts d'`alicyclo_std` alors que son nom annonçait une souche résistante distincte, et elle ne correspondait à aucune ligne du tableau transmis par la R&D — lequel ne connaît qu'un seul *Alicyclobacillus*. La clé reste acceptée en entrée et ramenée à `alicyclo_std`, de sorte que les analyses enregistrées qui la portent restent relues correctement.

Si une souche résistante d'*Alicyclobacillus* existe bien et doit être distinguée, elle demande ses propres $D_{\text{ref}}$ et $z$ : ajouter une entrée au tableau ci-dessus, jamais un doublon.

### 4.2. Produits et micro-organisme de référence

| Clé | Produit | Micro-organisme de référence | VP cible (UP) |
| :--- | :--- | :--- | ---: |
| `jus_pomme` | Jus de pomme | `byssochlamys_fulva` | 27.15 |
| `cidre_doux` | Cidre doux et demi-sec | `saccharo_cidre` | 16.50 |
| `cidre_brut` | Cidre brut et extra-brut | `saccharo_cidre_low` | 6.00 |

Les types `cidre_demi_sec` et `cidre_extra_brut` restent acceptés en entrée et sont ramenés respectivement à `cidre_doux` et `cidre_brut` : des lots et des analyses enregistrées les portent encore.

### 4.3. Cibles évaluées selon le mode

| Produit | Mode classique | Mode expert (en plus) |
| :--- | :--- | :--- |
| Jus de pomme | `byssochlamys_fulva`, `alicyclo_std`, `saccharo_jus`, `ecoli` | `salmonella`, `listeria` |
| Cidre doux et demi-sec | `saccharo_cidre` | `ecoli`, `salmonella` |
| Cidre brut et extra-brut | `saccharo_cidre_low` | `ecoli`, `salmonella` |

En mode classique, le jus de pomme est évalué simultanément sur ses quatre cibles ; les cidres le sont sur leur unique cible de référence.

---

## 5. Diagnostic et évaluation multi-cibles

**Mode multi-micro-organismes (jus de pomme).** Les quatre cibles du mode classique — *Byssochlamys fulva*, *Alicyclobacillus acidoterrestris*, *Saccharomyces cerevisiae*, *Escherichia coli* — sont évaluées en parallèle, chacune à sa propre température de référence.

**Règle du facteur limitant.** Le produit est diagnostiqué globalement conforme **uniquement si $k_{\text{calc}} \ge 15{,}0$ est validé pour l'ensemble des cibles**. Le verdict, la VP rapportée, la courbe et le message décrivent la cible dont le $k_{\text{calc}}$ est le plus faible — celle qui décide.

Un utilisateur expert qui désigne une cible ou impose $T_{\text{ref}}$ / $z$ reprend la main sur les chiffres rapportés, mais le verdict continue de couvrir l'ensemble des cibles affichées : un enregistrement « conforme » ne peut pas coexister avec une cible affichée « insuffisant ».

**Mode mono-cible (cidres).** L'évaluation porte sur *Saccharomyces cerevisiae*, avec un $D_{\text{ref}}$ distinct selon la teneur en sucres résiduels : doux et demi-sec d'une part, brut et extra-brut d'autre part.

---

## 6. Points à confirmer

Les valeurs de cette section sont en usage dans l'application et produisent des résultats aujourd'hui. Plusieurs ont été arrêtées en discussion sans être consignées : ce qui manque est la **trace écrite**, pas nécessairement le fondement.

Cette section les rassemble pour qu'une confirmation puisse être donnée une fois, et qu'elle serve de référence ensuite. Aucune n'intervient dans le calcul de la valeur pasteurisatrice ni dans le critère de conformité — ceux-là reposent entièrement sur les §1 à §5.

N'y figure que ce qui appelle une décision : les questions purement techniques relèvent du code, pas de ce document.

### 6.1. Seuils de faisabilité du barème

L'aide au choix du barème qualifie chaque temps de maintien de « réalisable », « exigeant » ou « réalisable mais nécessitant un changement de matériel ».

| Procédé | Réalisable | Exigeant | Au-delà |
| :--- | ---: | ---: | :--- |
| Flash-pasteurisation | ≤ 0,5 min | ≤ 2 min | changement de matériel |
| Pasteurisation classique et tunnel | ≤ 30 min | ≤ 120 min | changement de matériel |

Une alerte s'affiche par ailleurs au-delà de **1 min de maintien en flash-pasteurisation**.

*À confirmer : ces cinq seuils correspondent-ils aux capacités des équipements de la filière ?*

### 6.2. Seuils d'écart colorimétrique

Le module d'assemblage qualifie l'écart à la couleur cible à partir du $\Delta E_{00}$ :

| $\Delta E_{00}$ | Statut enregistré |
| :--- | :--- |
| < 3 | RÉUSSI |
| < 6 | ACCEPTABLE |
| ≥ 6 | ÉCART |

Ce statut est archivé avec l'analyse.

*À confirmer : ces seuils conviennent-ils pour des jus et cidres, ou faut-il des bornes propres à la filière ?*

### 6.3. Seuils d'alcool dans la désignation des cidres

L'application décrit les produits comme « Cidre doux et demi-sec (**< 4 % vol.**) » et « Cidre brut et extra-brut (**> 4 % vol.**) ». Le tableau des micro-organismes nomme ces catégories sans mentionner de seuil.

*À confirmer : le seuil de 4 % vol. est-il la bonne frontière entre les deux catégories, sachant qu'elles relèvent aussi d'une définition réglementaire ?*

### 6.4. Choix normatifs du pipeline colorimétrique

| Choix | Valeur retenue |
| :--- | :--- |
| Formule d'écart | CIEDE2000 (et non CIE76) |
| Illuminant | D65 |
| Observateur | CIE 1931, 2° |
| Domaine d'intégration | 380–780 nm, pas de 10 nm |
| Hors plage mesurée | densité optique supposée nulle (transmittance 100 %) |

La dernière ligne a un effet mesurable : un spectre relevé de 400 à 700 nm voit ses deux bandes extrêmes traitées comme parfaitement transparentes, ce qui tire le $L^*$ vers le clair d'un montant dépendant de l'appareil.

*À confirmer : ces conventions sont-elles celles employées par la R&D, et comment traiter un spectre plus étroit que le domaine CIE ?*

---

## 7. Historique des révisions

| Date | Révision |
| :--- | :--- |
| 30/07/2026 | Référentiel micro-organismes et produits en vigueur (§4). |
| 01/09/2026 | Regroupement des types produit : doux et demi-sec d'une part, brut et extra-brut d'autre part, partageant micro-organisme de référence et VP cible. Les anciens types restent acceptés en entrée. |
| 01/09/2026 | L'unité de la colonne temps devient une déclaration explicite de l'opérateur, au lieu d'être déduite du procédé. |
| 02/09/2026 | **Retrait de la majoration de 20 % appliquée à la VP cible des produits troubles.** La distinction trouble / limpide ne fait plus partie du référentiel : la VP cible d'un micro-organisme s'applique telle quelle, quel que soit l'état de clarification du produit. |
| 02/09/2026 | Explicitation de la règle du facteur limitant (§5) et de la transposition du $D$ à la température de référence retenue (§3.2). |
| 02/09/2026 | **Retrait de l'entrée `alicyclo_res`**, doublon d'`alicyclo_std` sans correspondance dans le tableau transmis par la R&D. La clé reste acceptée en entrée. |
| 02/09/2026 | **Retrait de l'indicateur de risque composite** (score construit sur le rapport VP/cible, la teneur en sucres résiduels, le pH et le titre alcoométrique). Ses pondérations et ses seuils n'étaient consignés nulle part ; il n'était affiché dans aucun écran mais était archivé avec l'analyse. |
| 02/09/2026 | **Retrait du pH** de l'ensemble de la chaîne : paramètre d'entrée, valeurs typiques par produit et alerte associée. Il n'alimentait que l'indicateur de risque et n'était saisissable dans aucun écran. |
| 02/09/2026 | Recensement au §6 des points en usage dont la justification reste à consigner. |
| 02/09/2026 | **Retrait du statut « Vigilance ».** Un troisième niveau de verdict figurait dans les traductions et les couleurs d'affichage sans qu'aucun seuil ne le définisse ; le moteur ne l'a jamais produit. Les verdicts sont « Conforme » et « Insuffisant ». |

> Une analyse antérieure à une révision a été jugée selon les règles alors en vigueur. Ce tableau est le seul moyen de la réinterpréter correctement : il ne doit pas être élagué.
