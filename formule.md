# Documentation Scientifique — Calculs de Pasteurisation & Paramétrage IFPC

Document de référence récapitulant les formules mathématiques, les modèles scientifiques et les règles de paramétrage appliqués sur la plateforme IFPC.

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

La conformité globale d'un barème de pasteurisation s'appuie sur le **nombre de réductions décimales calculé ($k_{\text{calc}}$)** de la population microbienne :

$$k_{\text{calc}} = \frac{\text{VP}}{D_{\text{ref}}}$$

Où :
* **$\text{VP}$** : Valeur Pasteurisatrice totale cumulée obtenue (en **UP**).
* **$D_{\text{ref}}$** : Temps de réduction décimale du micro-organisme cible à la température $T_{\text{ref}}$ (en **minutes**).

### Règle de Décision de Conformité :

$$\text{Statut} = \begin{cases} \mathbf{Conforme} & \text{si } k_{\text{calc}} > 15 \\ \mathbf{Insuffisant} & \text{si } k_{\text{calc}} \le 15 \end{cases}$$

* **$k_{\text{calc}} > 15$** : Le traitement thermique assure une réduction d'au moins 15 log ($10^{15}$) de la population microbienne ciblée, validant la conformité sanitaire et la stabilité du produit.
* **$k_{\text{calc}} \le 15$** : Les conditions de pasteurisation sont considérées comme insuffisantes pour garantir la destruction complète.

---

## 5. Référentiel des Micro-organismes & Produits IFPC

| Produit | Micro-organisme de référence | $T_{\text{ref}}$ (°C) | $z$ (°C) | $D_{\text{ref}}$ (min) | VP Cible Limpide (UP) | VP Cible Trouble (+20%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Jus de pomme** | *Byssochlamys fulva* | 95.0 | 7.1 | 1.8 | **9.0 UP** | **10.8 UP** |
| **Cidres** (*doux, demi-sec, brut, extra-brut*) | *Saccharomyces cerevisiae* | 60.0 | 4.0 | 1.1 | **5.5 UP** | **6.6 UP** |
| **Pathogènes** (*E. coli*) | *Escherichia coli* | 62.0 | 6.0 | 1.5 | **7.5 UP** | **9.0 UP** |
| **Pathogènes** (*Salmonella*) | *Salmonella* | 62.0 | 6.0 | 0.5 | **2.5 UP** | **3.0 UP** |
| **Pathogènes** (*Listeria*) | *Listeria monocytogenes* | 62.0 | 5.6 | 0.4 | **2.0 UP** | **2.4 UP** |
| **Thermo-résistant** (*Alicyclobacillus*) | *Alicyclobacillus acidoterrestris* | 95.0 | 16.4 | 27.8 | **139.0 UP** | **166.8 UP** |
