# Documentation Scientifique — Calculs de Pasteurisation & Paramétrage IFPC

Document de référence récapitulant les formules mathématiques, les modèles scientifiques et les règles de paramétrage appliqués sur la plateforme PADOC (mis à jour selon le référentiel du 30/07/2026).

---

## 1. Formule du Taux Létal ($L$)

Le **Taux Létal ($L$)** (ou vitesse relative de destruction thermique) quantifie l'efficacité destructrice de la température instantanée $T$ par rapport à la température de référence $T_{\text{ref}}$ du micro-organisme cible.

### Formule Mathématique

$$L = 10^{\frac{T - T_{\text{ref}}}{z}}$$

#### Signification des variables :
* **$T$** : Température mesurée ou de consigne du produit (en **°C**).
* **$T_{\text{ref}}$** : Température de référence du micro-organisme (en **°C**).
* **$z$** : Équivalent thermique de destruction du micro-organisme (en **°C**), correspondant à l'élévation de température nécessaire pour réduire d'un facteur 10 la valeur $D$.

---

## 2. Calcul de la Valeur Pasteurisatrice ($\text{VP}$)

La **Valeur Pasteurisatrice ($\text{VP}$)**, exprimée en **Unités de Pasteurisation (UP)**, quantifie le cumul de l'effet destructeur de la chaleur tout au long du traitement thermique selon la méthode de Bigelow.

### Formule Intégrale & Discrète

$$\text{VP} = \int_{0}^{t} L(t) \, dt = \sum_{i=1}^{n} \left( \frac{L_{i-1} + L_i}{2} \right) \times \Delta t_i$$

#### Temps de maintien théorique ($t_{\text{maintien}}$) :
$$\text{VP} = L \times t_{\text{maintien}} \implies t_{\text{maintien}} = \frac{\text{VP}_{\text{cible}}}{L} = \frac{\text{VP}_{\text{cible}}}{10^{\frac{T - T_{\text{ref}}}{z}}}$$

* **Flash-pasteurisation** : Temps exprimé en **secondes** ($\text{sec} = t_{\text{maintien}} \times 60$).
* **Pasteurisation classique et tunnel** : Temps exprimé en **minutes** ($\text{min}$).

---

## 3. Majoration de la VP Cible pour Produits Troubles (+20%)

Lorsque le produit est qualifié de **trouble** (par opposition à **limpide**), une marge de sécurité automatique de **+20%** (coefficient $1.2\times$) est appliquée sur la $\text{VP}_{\text{cible}}$ :

$$\text{VP}_{\text{cible (trouble)}} = \text{VP}_{\text{cible (limpide)}} \times 1.2$$

### Justifications Scientifiques & Thermiques :

1. **Effet de masque et thermoprotection des particules** :
   * Dans un jus ou cidre trouble, la pulpe, les pectines et les débris cellulaires créent une matrice protectrice.
   * Les micro-organismes piégés au cœur d'un agrégat subissent un transfert thermique plus lent par conduction locale.
2. **Perturbation de la convection thermique** :
   * La présence de suspensions solides freine les mouvements fluides de convection au sein du produit (notamment en bouteille). La majoration garantit que le cœur des zones à faible brassage atteint la dose d'UP requise.
3. **Charge microbiologique initiale (Inoculum)** :
   * Un produit non filtré/trouble présente généralement une charge particulaire et microbienne initiale plus importante qu'un produit clarifié, nécessitant une réduction log plus poussée.

---

## 4. Critère de Conformité Microbiologique ($k_{\text{calc}}$)

La conformité globale d'un barème de pasteurisation s'appuie sur le **facteur de réduction logarithmique calculé ($k_{\text{calc}}$)** de la population microbienne :

$$k_{\text{calc}} = \frac{\text{VP}}{D_{\text{ref}}}$$

Où :
* **$\text{VP}$** : Valeur Pasteurisatrice totale cumulée obtenue (en **UP**).
* **$D_{\text{ref}}$** : Temps de réduction décimale du micro-organisme cible à la température $T_{\text{ref}}$ (en **minutes**).

### Règle de Décision de Conformité (Seuil de 15-Log) :

$$\text{Statut} = \begin{cases} \mathbf{Conforme} & \text{si } k_{\text{calc}} \ge 15.0 \\ \mathbf{Insuffisant} & \text{si } k_{\text{calc}} < 15.0 \end{cases}$$

### Fondement Microbiologique du $k_{\text{calc}} \ge 15.0$ :
Conforme pour un micro-organisme de référence donné, dans l'hypothèse d'une population initiale de $10^6 \text{ ufc/mL}$ avant pasteurisation et la présence de moins de 1 micro-organisme pour $1\,000\,000$ bouteilles après traitement thermique, ce qui équivaut à une réduction logarithmique de 15 ($10^{15}$).

Ce facteur correspond à la réduction logarithmique de la population microbienne. Par exemple, si ce facteur est de 6, cela équivaut à une division de la population par $10^6$, soit une division par $1\,000\,000$.

---

## 5. Référentiel Officiel des Micro-organismes & Produits IFPC (Mis à jour le 30/07/2026)

### 5.1. Tableau des Paramètres Scientifiques

#### Pour Jus de pomme :
| Micro-organisme | $T_{\text{ref}}$ (°C) | $D_{\text{ref}}$ (min) à $T_{\text{ref}}$ | $z$ (°C) | Mode Classique | Mode Expert | VP Cible 15-log Limpide (UP) | VP Cible 15-log Trouble (+20%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| ***Byssochlamys fulva*** | 95.0 | 1.81 | 7.1 | **OUI** | OUI | **27.15 UP** | **32.58 UP** |
| ***Alicyclobacillus acidoterrestris*** | 95.0 | 27.80 | 16.4 | **OUI** | OUI | **417.00 UP** | **500.40 UP** |
| ***Saccharomyces cerevisiae*** | 60.0 | 22.50 | 4.0 | **OUI** | OUI | **337.50 UP** | **405.00 UP** |
| ***Escherichia coli*** | 62.0 | 1.50 | 6.0 | **OUI** | OUI | **22.50 UP** | **27.00 UP** |
| ***Salmonella*** | 62.0 | 0.49 | 6.0 | Non | OUI | **7.35 UP** | **8.82 UP** |
| ***Listeria monocytogenes*** | 62.0 | 0.43 | 5.6 | Non | OUI | **6.45 UP** | **7.74 UP** |

#### Pour les Cidres :
| Type de produit | Micro-organisme de référence | $T_{\text{ref}}$ (°C) | $D_{\text{ref}}$ (min) à $T_{\text{ref}}$ | $z$ (°C) | Mode Classique | Mode Expert | VP Cible 15-log Limpide (UP) | VP Cible 15-log Trouble (+20%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Cidre doux & Demi-sec** | *Saccharomyces cerevisiae* | 60.0 | 1.10 | 4.0 | **OUI** | OUI | **16.50 UP** | **19.80 UP** |
| **Cidre brut & Extra-brut** | *Saccharomyces cerevisiae* | 60.0 | 0.40 | 4.0 | **OUI** | OUI | **6.00 UP** | **7.20 UP** |
| **Cidre (tout type)** | *Escherichia coli* | 62.0 | 1.50 | 6.0 | Non | OUI | **22.50 UP** | **27.00 UP** |
| **Cidre (tout type)** | *Salmonella* | 62.0 | 0.49 | 6.0 | Non | OUI | **7.35 UP** | **8.82 UP** |

---

## 6. Diagnostic et Évaluation Multi-Microorganismes

* **Mode Multi-Microorganismes (Jus de Pomme)** : Les 4 micro-organismes du Mode Classique (*Byssochlamys fulva*, *Alicyclobacillus acidoterrestris*, *Saccharomyces cerevisiae*, *Escherichia coli*) sont évalués en parallèle. Le produit est diagnostiqué globalement conforme uniquement si la condition $k_{\text{calc}} \ge 15.0$ est validée pour l'ensemble des cibles.
* **Mode Mono-Microorganisme (Cidres)** : L'évaluation porte sur *Saccharomyces cerevisiae*, avec un seuil spécifique selon la teneur en sucres résiduels (doux/demi-sec vs brut/extra-brut).
