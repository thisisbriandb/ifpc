import math
from typing import Dict, List, Optional, Tuple

SUPPORTED_LOCALES = {"fr", "en"}

# ---------------------------------------------------------------------------
# Base de données des microorganismes (Tref en °C, Z en °C, VP cible en UP)
# ---------------------------------------------------------------------------
MICROORGANISMES: Dict[str, Dict] = {
    # Alicyclobacillus acidoterrestris — jus de pomme
    "alicyclo_std": {
        "nom": "Alicyclobacillus acidoterrestris",
        "t_ref": 95.0,
        "z": 10.9,
        "d_ref": 20.8,
        "vp_cible_min": 104.0,
        "description": "Réf. standard — D=20,8 min à 95°C",
    },
    "alicyclo_res": {
        "nom": "Alicyclobacillus acidoterrestris",
        "t_ref": 95.0,
        "z": 16.4,
        "d_ref": 27.8,
        "vp_cible_min": 139.0,
        "description": "Réf. résistante — D=27,8 min à 95°C (défaut jus de pomme)",
    },
    # Pathogènes (communs jus pomme + cidre)
    "ecoli": {
        "nom": "Escherichia coli",
        "t_ref": 62.0,
        "z": 6.0,
        "d_ref": 1.5,
        "vp_cible_min": 7.5,
        "description": "Pathogène entérique — D=1,5 min à 62°C",
    },
    "salmonella": {
        "nom": "Salmonella",
        "t_ref": 62.0,
        "z": 6.0,
        "d_ref": 0.5,
        "vp_cible_min": 2.5,
        "description": "Pathogène entérique — D=0,5 min à 62°C",
    },
    # Byssochlamys fulva — jus de pomme
    "byssochlamys_fulva": {
        "nom": "Byssochlamys fulva",
        "t_ref": 95.0,
        "z": 7.1,
        "d_ref": 1.8,
        "vp_cible_min": 9.0,
        "description": "Moisissure thermorésistante — D=1,8 min à 95°C",
    },
    # Saccharomyces cerevisiae — jus de pomme
    "saccharo_jus": {
        "nom": "Saccharomyces cerevisiae",
        "t_ref": 60.0,
        "z": 4.0,
        "d_ref": 22.5,
        "vp_cible_min": 112.5,
        "description": "Jus de pomme — D=22,5 min à 60°C",
    },
    # Saccharomyces cerevisiae — cidre
    "saccharo_cidre_low": {
        "nom": "Saccharomyces cerevisiae",
        "t_ref": 60.0,
        "z": 4.0,
        "d_ref": 0.4,
        "vp_cible_min": 2.0,
        "description": "Cidre — D=0,4 min à 60°C",
    },
    "saccharo_cidre": {
        "nom": "Saccharomyces cerevisiae",
        "t_ref": 60.0,
        "z": 4.0,
        "d_ref": 1.1,
        "vp_cible_min": 5.5,
        "description": "Cidre réf. — D=1,1 min à 60°C (défaut cidre)",
    },
}

# ---------------------------------------------------------------------------
# Base de données des produits cidricoles
# ---------------------------------------------------------------------------
PRODUITS: Dict[str, Dict] = {
    "jus_pomme": {
        "nom": "Jus de pomme",
        "microorganisme_defaut": "alicyclo_res",
        "vp_cible_min": 139.0,
        "ph_typique": 3.5,
        "description": "Jus de pomme pasteurisé",
    },
    "cidre_doux": {
        "nom": "Cidre doux",
        "microorganisme_defaut": "saccharo_cidre",
        "vp_cible_min": 5.5,
        "ph_typique": 3.6,
        "description": "Cidre doux (< 3% vol.)",
    },
    "cidre_demi_sec": {
        "nom": "Cidre demi-sec",
        "microorganisme_defaut": "saccharo_cidre",
        "vp_cible_min": 5.5,
        "ph_typique": 3.5,
        "description": "Cidre demi-sec (3-4% vol.)",
    },
    "cidre_brut": {
        "nom": "Cidre brut",
        "microorganisme_defaut": "saccharo_cidre",
        "vp_cible_min": 5.5,
        "ph_typique": 3.4,
        "description": "Cidre brut (4-5% vol.)",
    },
    "cidre_extra_brut": {
        "nom": "Cidre extra-brut",
        "microorganisme_defaut": "saccharo_cidre",
        "vp_cible_min": 5.5,
        "ph_typique": 3.3,
        "description": "Cidre extra-brut (> 5% vol.)",
    },
}

CLARIFICATIONS = ["trouble", "limpide"]

PROCEDES = {
    "flash": {"nom": "Pasteurisation flash", "description": "Haute température, courte durée"},
    "classique": {"nom": "Pasteurisation classique", "description": "Température modérée, durée moyenne"},
    "tunnel": {"nom": "Tunnel / douchette", "description": "Pasteurisation en bouteille"},
}

TRANSLATIONS = {
    "products": {
        "jus_pomme": {"fr": "Jus de pomme", "en": "Apple juice"},
        "cidre_doux": {"fr": "Cidre doux", "en": "Sweet cider"},
        "cidre_demi_sec": {"fr": "Cidre demi-sec", "en": "Semi-dry cider"},
        "cidre_brut": {"fr": "Cidre brut", "en": "Dry cider"},
        "cidre_extra_brut": {"fr": "Cidre extra-brut", "en": "Extra-dry cider"},
    },
    "procedes": {
        "flash": {"fr": "Pasteurisation flash", "en": "Flash pasteurisation"},
        "classique": {"fr": "Pasteurisation classique", "en": "Conventional pasteurisation"},
        "tunnel": {"fr": "Tunnel / douchette", "en": "Tunnel / spray"},
    },
    "clarifications": {
        "trouble": {"fr": "Trouble", "en": "Turbid"},
        "limpide": {"fr": "Limpide", "en": "Clear"},
    },
    "risk_levels": {
        "faible": {"fr": "faible", "en": "low"},
        "modéré": {"fr": "modéré", "en": "moderate"},
        "élevé": {"fr": "élevé", "en": "high"},
    },
    "risk_advice": {
        "faible": {
            "fr": "Conditions de pasteurisation satisfaisantes.",
            "en": "Pasteurisation conditions are satisfactory.",
        },
        "modéré": {
            "fr": "Vérifiez les conditions de stockage et la chaîne du froid.",
            "en": "Check storage conditions and the cold chain.",
        },
        "élevé": {
            "fr": "Pasteurisation probablement insuffisante. Risque d'altération ou de refermentation.",
            "en": "Pasteurisation is likely insufficient. Risk of spoilage or re-fermentation.",
        },
    },
}


def normalize_locale(locale: Optional[str]) -> str:
    value = (locale or "fr").lower()
    return value if value in SUPPORTED_LOCALES else "fr"


def translate(group: str, key: str, locale: str, fallback: Optional[str] = None) -> str:
    lang = normalize_locale(locale)
    return TRANSLATIONS.get(group, {}).get(key, {}).get(lang, fallback or key)


def localize_product_name(product_type: str, locale: str) -> str:
    fallback = PRODUITS.get(product_type, {}).get("nom", product_type)
    return translate("products", product_type, locale, fallback)


def localize_procede_name(procede: Optional[str], locale: str) -> Optional[str]:
    if procede is None:
        return None
    fallback = PROCEDES.get(procede, {}).get("nom", procede)
    return translate("procedes", procede, locale, fallback)


def localize_clarification_name(clarification: Optional[str], locale: str) -> Optional[str]:
    if clarification is None:
        return None
    return translate("clarifications", clarification, locale, clarification)


def build_diagnostic_message(statut: str, vp_obtenue: float, vp_cible: float, locale: str) -> str:
    lang = normalize_locale(locale)
    if lang == "en":
        if statut == "conforme":
            return f"Pasteurisation compliant. PU = {vp_obtenue:.2f} (target >= {vp_cible:.1f})."
        if statut == "vigilance":
            return f"Pasteurisation close to threshold. PU = {vp_obtenue:.2f} (target >= {vp_cible:.1f}). Safety margin is limited."
        return f"Pasteurisation insufficient. PU = {vp_obtenue:.2f} (target >= {vp_cible:.1f})."
    if statut == "conforme":
        return f"Pasteurisation conforme. VP = {vp_obtenue:.2f} UP (cible >= {vp_cible:.1f} UP)."
    if statut == "vigilance":
        return f"Pasteurisation proche du seuil. VP = {vp_obtenue:.2f} UP (cible >= {vp_cible:.1f} UP). Marge insuffisante."
    return f"Pasteurisation insuffisante. VP = {vp_obtenue:.2f} UP (cible >= {vp_cible:.1f} UP)."


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
    locale: str = "fr",
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
    lang = normalize_locale(locale)
    result_vp = calculer_vp_bigelow(temperatures, temps, effective_t_ref, effective_z)
    vp_obtenue = result_vp["vp"]

    # --- Diagnostic ---
    ratio = vp_obtenue / effective_vp_cible if effective_vp_cible > 0 else 0
    if ratio >= 1.0:
        statut = "conforme"
    elif ratio >= 0.8:
        statut = "vigilance"
    else:
        statut = "insuffisant"
    message = build_diagnostic_message(statut, vp_obtenue, effective_vp_cible, lang)

    # --- Risque ---
    risque = evaluer_risque(
        vp_obtenue, effective_vp_cible, product_type, micro_key,
        ph=ph, titre_alcool=titre_alcool, locale=lang,
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
            "produit": localize_product_name(product_type, lang),
            "clarification": localize_clarification_name(clarification, lang),
            "procede": localize_procede_name(procede, lang),
            "ph": ph,
            "titre_alcool": titre_alcool,
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
    locale: str = "fr",
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
    elif score <= 3:
        niveau = "modéré"
        couleur = "#F19B13"
    else:
        niveau = "élevé"
        couleur = "#E53E3E"
    conseil = translate("risk_advice", niveau, locale, "")

    return {
        "niveau": translate("risk_levels", niveau, locale, niveau),
        "score": score,
        "couleur": couleur,
        "conseil": conseil,
    }


# ---------------------------------------------------------------------------
# Aide au choix du barème
# ---------------------------------------------------------------------------
def proposer_bareme(
    product_type: str,
    locale: str = "fr",
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

    lang = normalize_locale(locale)

    return {
        "produit": localize_product_name(product_type, lang),
        "microorganisme": micro["nom"],
        "t_ref": t_ref,
        "z": z,
        "vp_cible": round(vp_cible, 2),
        "clarification": localize_clarification_name(clarification, lang),
        "procede": localize_procede_name(procede, lang),
        "baremes": baremes,
    }


# ---------------------------------------------------------------------------
# Utilitaires d'accès aux référentiels
# ---------------------------------------------------------------------------
def get_produits(locale: str = "fr") -> List[Dict]:
    lang = normalize_locale(locale)
    return [{"id": k, **v, "nom": localize_product_name(k, lang)} for k, v in PRODUITS.items()]


def get_microorganismes(locale: str = "fr") -> List[Dict]:
    return [{"id": k, **v} for k, v in MICROORGANISMES.items()]


def get_procedes(locale: str = "fr") -> List[Dict]:
    lang = normalize_locale(locale)
    return [{"id": k, **v, "nom": localize_procede_name(k, lang)} for k, v in PROCEDES.items()]


def get_clarifications(locale: str = "fr") -> List[Dict]:
    lang = normalize_locale(locale)
    return [{"id": key, "nom": localize_clarification_name(key, lang)} for key in CLARIFICATIONS]
