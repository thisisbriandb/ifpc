import math
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Base de données des microorganismes (Tref en °C, Z en °C, VP cible en UP)
# ---------------------------------------------------------------------------
MICROORGANISMES: Dict[str, Dict] = {
    "alicyclobacillus_acidoterrestris": {
        "nom": "Alicyclobacillus acidoterrestris",
        "t_ref": 60.0,
        "z": 7.0,
        "vp_cible_min": 15.0,
        "description": "Bactérie thermorésistante des jus acides",
    },
    "levures": {
        "nom": "Levures",
        "t_ref": 60.0,
        "z": 7.0,
        "vp_cible_min": 5.0,
        "description": "Levures de refermentation",
    },
    "moisissures": {
        "nom": "Moisissures",
        "t_ref": 60.0,
        "z": 7.0,
        "vp_cible_min": 10.0,
        "description": "Moisissures thermorésistantes",
    },
    "byssochlamys_fulva": {
        "nom": "Byssochlamys fulva",
        "t_ref": 60.0,
        "z": 7.0,
        "vp_cible_min": 20.0,
        "description": "Moisissure thermorésistante des fruits",
    },
    "lactobacilles": {
        "nom": "Lactobacilles",
        "t_ref": 60.0,
        "z": 7.0,
        "vp_cible_min": 5.0,
        "description": "Bactéries lactiques d'altération",
    },
}

# ---------------------------------------------------------------------------
# Base de données des produits cidricoles
# ---------------------------------------------------------------------------
PRODUITS: Dict[str, Dict] = {
    "jus_pomme": {
        "nom": "Jus de pomme",
        "microorganisme_defaut": "alicyclobacillus_acidoterrestris",
        "vp_cible_min": 15.0,
        "ph_typique": 3.5,
        "description": "Jus de pomme pasteurisé",
    },
    "cidre_doux": {
        "nom": "Cidre doux",
        "microorganisme_defaut": "levures",
        "vp_cible_min": 10.0,
        "ph_typique": 3.6,
        "description": "Cidre doux (< 3% vol.)",
    },
    "cidre_demi_sec": {
        "nom": "Cidre demi-sec",
        "microorganisme_defaut": "levures",
        "vp_cible_min": 8.0,
        "ph_typique": 3.5,
        "description": "Cidre demi-sec (3-4% vol.)",
    },
    "cidre_brut": {
        "nom": "Cidre brut",
        "microorganisme_defaut": "levures",
        "vp_cible_min": 5.0,
        "ph_typique": 3.4,
        "description": "Cidre brut (4-5% vol.)",
    },
    "cidre_extra_brut": {
        "nom": "Cidre extra-brut",
        "microorganisme_defaut": "levures",
        "vp_cible_min": 5.0,
        "ph_typique": 3.3,
        "description": "Cidre extra-brut (> 5% vol.)",
    },
    "jus_poire": {
        "nom": "Jus de poire",
        "microorganisme_defaut": "alicyclobacillus_acidoterrestris",
        "vp_cible_min": 15.0,
        "ph_typique": 3.8,
        "description": "Jus de poire pasteurisé",
    },
}

CLARIFICATIONS = ["trouble", "limpide"]

PROCEDES = {
    "flash": {"nom": "Pasteurisation flash", "description": "Haute température, courte durée"},
    "classique": {"nom": "Pasteurisation classique", "description": "Température modérée, durée moyenne"},
    "tunnel": {"nom": "Tunnel / douchette", "description": "Pasteurisation en bouteille"},
}


# ---------------------------------------------------------------------------
# Calcul VP par méthode de Bigelow
# ---------------------------------------------------------------------------
def calculer_vp_bigelow(
    temperatures: List[float],
    temps: List[float],
    t_ref: float = 60.0,
    z: float = 7.0,
) -> Dict:
    """
    Calcul de la Valeur Pasteurisatrice par la méthode de Bigelow.

    La courbe température/temps est découpée en intervalles.
    Pour chaque intervalle, on calcule le taux létal L = 10^((T - Tref) / z).
    La VP est la somme : VP = Σ L_i × Δt_i  (résultat en UP).

    Args:
        temperatures: liste des températures relevées (°C)
        temps: liste des instants correspondants (en minutes)
        t_ref: température de référence (°C)
        z: paramètre Z du microorganisme (°C)

    Returns:
        Dict avec vp, taux_letaux, temps, temperatures
    """
    if len(temperatures) != len(temps):
        raise ValueError("Les listes températures et temps doivent avoir la même longueur")
    if len(temperatures) < 2:
        raise ValueError("Il faut au moins 2 points de mesure")

    n = len(temperatures)
    taux_letaux: List[float] = []
    vp = 0.0
    vp_cumulee: List[float] = [0.0]

    for i in range(n):
        l_i = math.pow(10, (temperatures[i] - t_ref) / z)
        taux_letaux.append(round(l_i, 6))

    for i in range(1, n):
        dt = temps[i] - temps[i - 1]
        l_moy = (taux_letaux[i] + taux_letaux[i - 1]) / 2.0
        vp += l_moy * dt
        vp_cumulee.append(round(vp, 4))

    return {
        "vp": round(vp, 4),
        "taux_letaux": taux_letaux,
        "vp_cumulee": vp_cumulee,
        "temps": temps,
        "temperatures": temperatures,
        "t_ref": t_ref,
        "z": z,
    }


# ---------------------------------------------------------------------------
# Évaluation complète
# ---------------------------------------------------------------------------
def evaluer_pasteurisation(
    temperatures: List[float],
    temps: List[float],
    product_type: str = "jus_pomme",
    t_ref: Optional[float] = None,
    z: Optional[float] = None,
    vp_cible: Optional[float] = None,
    microorganisme: Optional[str] = None,
    clarification: Optional[str] = None,
    procede: Optional[str] = None,
    ph: Optional[float] = None,
    titre_alcool: Optional[float] = None,
) -> Dict:
    """
    Évaluation complète d'un cycle de pasteurisation.

    Mode standard : product_type détermine Tref, Z et VP cible.
    Mode expert   : microorganisme (ou Tref/Z manuels) override les valeurs.
    """
    # --- Résolution des paramètres ---
    produit = PRODUITS.get(product_type)
    if produit is None:
        raise ValueError(f"Type de produit inconnu : {product_type}")

    # Déterminer microorganisme et paramètres
    micro_key = microorganisme or produit["microorganisme_defaut"]
    micro = MICROORGANISMES.get(micro_key)

    effective_t_ref = t_ref if t_ref is not None else (micro["t_ref"] if micro else 60.0)
    effective_z = z if z is not None else (micro["z"] if micro else 7.0)
    effective_vp_cible = vp_cible if vp_cible is not None else (
        micro["vp_cible_min"] if micro else produit["vp_cible_min"]
    )

    # --- Calcul VP ---
    result_vp = calculer_vp_bigelow(temperatures, temps, effective_t_ref, effective_z)
    vp_obtenue = result_vp["vp"]

    # --- Diagnostic ---
    ratio = vp_obtenue / effective_vp_cible if effective_vp_cible > 0 else 0
    if ratio >= 1.0:
        statut = "conforme"
        message = (
            f"Pasteurisation conforme. VP = {vp_obtenue:.2f} UP "
            f"(cible ≥ {effective_vp_cible:.1f} UP)."
        )
    elif ratio >= 0.8:
        statut = "vigilance"
        message = (
            f"Pasteurisation proche du seuil. VP = {vp_obtenue:.2f} UP "
            f"(cible ≥ {effective_vp_cible:.1f} UP). Marge insuffisante."
        )
    else:
        statut = "insuffisant"
        message = (
            f"Pasteurisation insuffisante. VP = {vp_obtenue:.2f} UP "
            f"(cible ≥ {effective_vp_cible:.1f} UP)."
        )

    # --- Risque ---
    risque = evaluer_risque(
        vp_obtenue, effective_vp_cible, product_type, micro_key,
        ph=ph, titre_alcool=titre_alcool,
    )

    return {
        "vp": vp_obtenue,
        "vp_cible": effective_vp_cible,
        "statut": statut,
        "message": message,
        "risque": risque,
        "parametres": {
            "t_ref": effective_t_ref,
            "z": effective_z,
            "microorganisme": micro["nom"] if micro else micro_key,
            "produit": produit["nom"],
            "clarification": clarification,
            "procede": PROCEDES.get(procede, {}).get("nom", procede),
        },
        "courbe": {
            "temps": result_vp["temps"],
            "temperatures": result_vp["temperatures"],
            "taux_letaux": result_vp["taux_letaux"],
            "vp_cumulee": result_vp["vp_cumulee"],
        },
    }


# ---------------------------------------------------------------------------
# Évaluation du risque
# ---------------------------------------------------------------------------
def evaluer_risque(
    vp_obtenue: float,
    vp_cible: float,
    product_type: str,
    microorganisme: str,
    ph: Optional[float] = None,
    titre_alcool: Optional[float] = None,
) -> Dict:
    """Calcule un indicateur de risque (faible / modéré / élevé)."""
    score = 0

    ratio = vp_obtenue / vp_cible if vp_cible > 0 else 0
    if ratio >= 1.5:
        score += 0
    elif ratio >= 1.0:
        score += 1
    elif ratio >= 0.8:
        score += 2
    else:
        score += 3

    # Produits à sucre résiduel → risque refermentation
    if product_type in ("cidre_doux", "cidre_demi_sec", "jus_pomme", "jus_poire"):
        score += 1

    # pH élevé → plus de risque
    if ph is not None and ph > 3.8:
        score += 1

    # Alcool protège un peu
    if titre_alcool is not None and titre_alcool > 4.0:
        score -= 1

    score = max(0, score)

    if score <= 1:
        niveau = "faible"
        couleur = "#84A44A"
        conseil = "Conditions de pasteurisation satisfaisantes."
    elif score <= 3:
        niveau = "modéré"
        couleur = "#F19B13"
        conseil = "Vérifiez les conditions de stockage et la chaîne du froid."
    else:
        niveau = "élevé"
        couleur = "#E53E3E"
        conseil = "Pasteurisation probablement insuffisante. Risque d'altération ou de refermentation."

    return {
        "niveau": niveau,
        "score": score,
        "couleur": couleur,
        "conseil": conseil,
    }


# ---------------------------------------------------------------------------
# Aide au choix du barème
# ---------------------------------------------------------------------------
def proposer_bareme(
    product_type: str,
    microorganisme: Optional[str] = None,
    clarification: str = "trouble",
    procede: str = "classique",
) -> Dict:
    """Propose un barème adapté au produit et au microorganisme."""
    produit = PRODUITS.get(product_type)
    if produit is None:
        raise ValueError(f"Type de produit inconnu : {product_type}")

    micro_key = microorganisme or produit["microorganisme_defaut"]
    micro = MICROORGANISMES.get(micro_key)
    if micro is None:
        raise ValueError(f"Microorganisme inconnu : {micro_key}")

    t_ref = micro["t_ref"]
    z = micro["z"]
    vp_cible = micro["vp_cible_min"]

    # Ajustement selon clarification
    if clarification == "trouble":
        vp_cible *= 1.2  # marge de sécurité pour produit trouble

    # Propositions de barèmes (température → durée nécessaire en minutes)
    baremes = []
    for temp in [60, 63, 65, 68, 70, 72, 75, 78, 80, 85, 90, 95]:
        l = math.pow(10, (temp - t_ref) / z)
        duree_min = vp_cible / l if l > 0 else float("inf")
        duree_sec = duree_min * 60
        baremes.append({
            "temperature": temp,
            "duree_minutes": round(duree_min, 2),
            "duree_secondes": round(duree_sec, 1),
            "taux_letal": round(l, 4),
        })

    return {
        "produit": produit["nom"],
        "microorganisme": micro["nom"],
        "t_ref": t_ref,
        "z": z,
        "vp_cible": round(vp_cible, 2),
        "clarification": clarification,
        "procede": PROCEDES.get(procede, {}).get("nom", procede),
        "baremes": baremes,
    }


# ---------------------------------------------------------------------------
# Utilitaires d'accès aux référentiels
# ---------------------------------------------------------------------------
def get_produits() -> List[Dict]:
    return [{"id": k, **v} for k, v in PRODUITS.items()]


def get_microorganismes() -> List[Dict]:
    return [{"id": k, **v} for k, v in MICROORGANISMES.items()]


def get_procedes() -> List[Dict]:
    return [{"id": k, **v} for k, v in PROCEDES.items()]
