# Référentiel scientifique — Calculs de pasteurisation PADOC / IFPC

Document de référence des formules, des paramètres micro-organismes et des règles de décision appliqués par la plateforme PADOC.

**Ce document fait autorité sur le code.** Les tableaux du §4 sont lus directement par la suite de tests du moteur de calcul (`backend/tests/test_referentiel.py`) : toute divergence entre une valeur écrite ici et la valeur employée par le moteur fait échouer l'intégration continue. Modifier un paramètre scientifique se fait donc **ici**, et le code suit.

Référentiel micro-organismes en vigueur : **30/07/2026**. Voir l'historique des révisions au §6.

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

### 3.2. Cohérence des températures de référence

$k_{\text{calc}}$ n'a de sens que si $\text{VP}$ et $D_{\text{ref}}$ se rapportent à la **même** température de référence. Lorsqu'un utilisateur expert impose un $T_{\text{ref}}$ différent de celui de la table, le $D$ est transposé avant division :

$$D(T) = D(T_{\text{ref}}) \times 10^{\frac{T_{\text{ref}} - T}{z}}$$

$k_{\text{calc}}$ est ainsi invariant par changement de température de référence, comme il doit l'être.

---

## 4. Référentiel officiel des micro-organismes et produits

Mis à jour le **30/07/2026**.

La colonne « clé » donne l'identifiant technique de chaque entrée. Elle lève l'ambiguïté entre des souches homonymes (plusieurs entrées portent le nom *Saccharomyces cerevisiae*) et sert de point d'ancrage à la vérification automatique du code.

### 4.1. Paramètres des micro-organismes

| Clé | Micro-organisme | $T_{\text{ref}}$ (°C) | $D_{\text{ref}}$ (min) | $z$ (°C) | VP cible 15 log (UP) |
| :--- | :--- | ---: | ---: | ---: | ---: |
| `byssochlamys_fulva` | Byssochlamys fulva | 95.0 | 1.81 | 7.1 | 27.15 |
| `alicyclo_std` | Alicyclobacillus acidoterrestris | 95.0 | 27.80 | 16.4 | 417.00 |
| `alicyclo_res` | Alicyclobacillus acidoterrestris | 95.0 | 27.80 | 16.4 | 417.00 |
| `saccharo_jus` | Saccharomyces cerevisiae | 60.0 | 22.50 | 4.0 | 337.50 |
| `saccharo_cidre` | Saccharomyces cerevisiae 1 | 60.0 | 1.10 | 4.0 | 16.50 |
| `saccharo_cidre_low` | Saccharomyces cerevisiae 2 | 60.0 | 0.40 | 4.0 | 6.00 |
| `ecoli` | Escherichia coli | 62.0 | 1.50 | 6.0 | 22.50 |
| `salmonella` | Salmonella | 62.0 | 0.49 | 6.0 | 7.35 |
| `listeria` | Listeria monocytogenes | 62.0 | 0.43 | 5.6 | 6.45 |

> **`alicyclo_res` — point à trancher.** Cette entrée porte des paramètres strictement identiques à `alicyclo_std`, alors que son nom (« résistant ») annonce une souche distincte. Elle est conservée telle quelle parce que des analyses enregistrées la référencent, et parce que la liste du mode expert de l'interface propose `alicyclo_res` là où le moteur évalue `alicyclo_std` — sans écart de résultat, les deux entrées étant identiques. Deux issues possibles : donner à `alicyclo_res` les paramètres propres à la souche résistante, ou la supprimer du référentiel et aligner l'interface. **Décision R&D attendue.**

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

## 6. Historique des révisions

| Date | Révision |
| :--- | :--- |
| 30/07/2026 | Référentiel micro-organismes et produits en vigueur (§4). |
| 01/09/2026 | Regroupement des types produit : doux et demi-sec d'une part, brut et extra-brut d'autre part, partageant micro-organisme de référence et VP cible. Les anciens types restent acceptés en entrée. |
| 01/09/2026 | L'unité de la colonne temps devient une déclaration explicite de l'opérateur, au lieu d'être déduite du procédé. |
| 02/09/2026 | **Retrait de la majoration de 20 % appliquée à la VP cible des produits troubles.** La distinction trouble / limpide ne fait plus partie du référentiel : la VP cible d'un micro-organisme s'applique telle quelle, quel que soit l'état de clarification du produit. |
| 02/09/2026 | Explicitation de la règle du facteur limitant (§5) et de la transposition du $D$ à la température de référence retenue (§3.2). |

> Une analyse antérieure à une révision a été jugée selon les règles alors en vigueur. Ce tableau est le seul moyen de la réinterpréter correctement : il ne doit pas être élagué.
