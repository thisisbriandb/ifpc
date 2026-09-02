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
        "z": 16.4,
        "d_ref": 27.80,
        "vp_cible_min": 417.0,
        "description": "Réf. jus de pomme — D=27,8 min à 95°C",
    },
    "alicyclo_res": {
        "nom": "Alicyclobacillus acidoterrestris",
        "t_ref": 95.0,
        "z": 16.4,
        "d_ref": 27.80,
        "vp_cible_min": 417.0,
        "description": "Réf. jus de pomme — D=27,8 min à 95°C",
    },
    # Pathogènes (communs jus pomme + cidre)
    "ecoli": {
        "nom": "Escherichia coli",
        "t_ref": 62.0,
        "z": 6.0,
        "d_ref": 1.50,
        "vp_cible_min": 22.5,
        "description": "Pathogène entérique — D=1,5 min à 62°C",
    },
    "salmonella": {
        "nom": "Salmonella",
        "t_ref": 62.0,
        "z": 6.0,
        "d_ref": 0.49,
        "vp_cible_min": 7.35,
        "description": "Pathogène entérique — D=0,49 min à 62°C",
    },
    "listeria": {
        "nom": "Listeria monocytogenes",
        "t_ref": 62.0,
        "z": 5.6,
        "d_ref": 0.43,
        "vp_cible_min": 6.45,
        "description": "Pathogène — D=0,43 min à 62°C",
    },
    # Byssochlamys fulva — jus de pomme
    "byssochlamys_fulva": {
        "nom": "Byssochlamys fulva",
        "t_ref": 95.0,
        "z": 7.1,
        "d_ref": 1.81,
        "vp_cible_min": 27.15,
        "description": "Moisissure thermorésistante — D=1,81 min à 95°C",
    },
    # Saccharomyces cerevisiae — jus de pomme
    "saccharo_jus": {
        "nom": "Saccharomyces cerevisiae",
        "t_ref": 60.0,
        "z": 4.0,
        "d_ref": 22.50,
        "vp_cible_min": 337.5,
        "description": "Jus de pomme — D=22,5 min à 60°C",
    },
    # Saccharomyces cerevisiae — cidre doux & demi-sec
    "saccharo_cidre": {
        "nom": "Saccharomyces cerevisiae 1",
        "t_ref": 60.0,
        "z": 4.0,
        "d_ref": 1.10,
        "vp_cible_min": 16.5,
        "description": "Cidre doux & demi-sec — D=1,1 min à 60°C",
    },
    # Saccharomyces cerevisiae — cidre brut & extra-brut
    "saccharo_cidre_low": {
        "nom": "Saccharomyces cerevisiae 2",
        "t_ref": 60.0,
        "z": 4.0,
        "d_ref": 0.40,
        "vp_cible_min": 6.0,
        "description": "Cidre brut & extra-brut — D=0,4 min à 60°C",
    },
}

# ---------------------------------------------------------------------------
# Base de données des produits cidricoles
# ---------------------------------------------------------------------------
PRODUITS: Dict[str, Dict] = {
    "jus_pomme": {
        "nom": "Jus de pomme",
        "microorganisme_defaut": "byssochlamys_fulva",
        "vp_cible_min": 27.15,
        "ph_typique": 3.5,
        "description": "Jus de pomme pasteurisé",
        "microorganismes_associes": [
            {"key": "byssochlamys_fulva", "classique": True},
            {"key": "alicyclo_std",       "classique": True},
            {"key": "saccharo_jus",       "classique": True},
            {"key": "ecoli",              "classique": True},
            {"key": "salmonella",          "classique": False},
            {"key": "listeria",            "classique": False},
        ],
    },
    # Doux et demi-sec partagent le même microorganisme de référence et la même
    # VP cible : ils ne formaient qu'un seul cas, ils ne font plus qu'une entrée.
    "cidre_doux": {
        "nom": "Cidre doux et demi-sec",
        "microorganisme_defaut": "saccharo_cidre",
        "vp_cible_min": 16.5,
        "ph_typique": 3.6,
        "description": "Cidre doux et demi-sec (< 4% vol.)",
        "microorganismes_associes": [
            {"key": "saccharo_cidre", "classique": True},
            {"key": "ecoli",          "classique": False},
            {"key": "salmonella",      "classique": False},
        ],
    },
    "cidre_brut": {
        "nom": "Cidre brut et extra-brut",
        "microorganisme_defaut": "saccharo_cidre_low",
        "vp_cible_min": 6.0,
        "ph_typique": 3.4,
        "description": "Cidre brut et extra-brut (> 4% vol.)",
        "microorganismes_associes": [
            {"key": "saccharo_cidre_low", "classique": True},
            {"key": "ecoli",              "classique": False},
            {"key": "salmonella",          "classique": False},
        ],
    },
}

# Les types supprimés par le regroupement restent acceptés en entrée : des lots,
# des configurations produit et des analyses enregistrées les portent encore.
ALIAS_PRODUITS: Dict[str, str] = {
    "cidre_demi_sec": "cidre_doux",
    "cidre_extra_brut": "cidre_brut",
}


def normaliser_product_type(product_type: str) -> str:
    """Ramène un type de produit hérité vers l'entrée qui l'a absorbé."""
    return ALIAS_PRODUITS.get(product_type, product_type)


# Unité dans laquelle l'utilisateur a relevé la colonne « temps ». Le calcul de
# Bigelow travaille en minutes : c'est la seule donnée qui, mal renseignée,
# fausse la VP d'un facteur 60. Le choix est donc explicite et obligatoire.
UNITES_TEMPS = ["minute", "seconde"]

PROCEDES = {
    "flash": {"nom": "Flash-pasteurisation ", "description": "Haute température, courte durée"},
    "classique": {"nom": "Pasteurisation classique", "description": "Température modérée, durée moyenne"},
    "tunnel": {"nom": "Pasteurisation Tunnel", "description": "Pasteurisation en bouteille"},
}

TRANSLATIONS = {
    "products": {
        "jus_pomme": {"fr": "Jus de pomme", "en": "Apple juice"},
        "cidre_doux": {"fr": "Cidre doux et demi-sec", "en": "Sweet and semi-dry cider"},
        "cidre_brut": {"fr": "Cidre brut et extra-brut", "en": "Dry and extra-dry cider"},
    },
    "procedes": {
        "flash": {"fr": "Flash-pasteurisation", "en": "Flash pasteurisation"},
        "classique": {"fr": "Pasteurisation classique", "en": "Conventional pasteurisation"},
        "tunnel": {"fr": "Pasteurisation Tunnel", "en": "Tunnel / spray"},
    },
    "unites_temps": {
        "minute": {"fr": "Minute", "en": "Minute"},
        "seconde": {"fr": "Seconde", "en": "Second"},
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
    fallback = PRODUITS.get(normaliser_product_type(product_type), {}).get("nom", product_type)
    return translate("products", product_type, locale, fallback)


def localize_procede_name(procede: Optional[str], locale: str) -> Optional[str]:
    if procede is None:
        return None
    fallback = PROCEDES.get(procede, {}).get("nom", procede)
    return translate("procedes", procede, locale, fallback)


def localize_unite_temps_name(unite: Optional[str], locale: str) -> Optional[str]:
    if unite is None:
        return None
    return translate("unites_temps", unite, locale, unite)


def build_diagnostic_message(statut: str, vp_obtenue: float, vp_cible: float, locale: str, microorganisme: str = "", product_type: str = "") -> str:
    lang = normalize_locale(locale)
    cible_int = int(round(vp_cible))

    if lang == "en":
        if statut in ("conforme", "vigilance"):
            msg = (
                f"Pasteurisation conditions are sufficient to reduce the risk "
                f"related to {microorganisme}."
            ) if microorganisme else (
                f"Pasteurisation compliant. PU = {vp_obtenue:.2f} (target >= {cible_int} UP)."
            )
            if statut == "vigilance":
                msg += " However, the safety margin is limited."
            return msg
        # insuffisant
        msg = (
            f"Pasteurisation conditions are insufficient to reduce the risk "
            f"related to {microorganisme}.\n\n"
            f"It is recommended to adjust the pasteurisation schedule."
        ) if microorganisme else (
            f"Pasteurisation insufficient. PU = {vp_obtenue:.2f} (target >= {cible_int} UP)."
        )
        return msg

    # --- French ---
    if statut in ("conforme", "vigilance"):
        if microorganisme.lower().startswith("byssochlamys"):
            msg = (
                f"Les conditions de pasteurisation sont suffisantes pour "
                f"réduire le risque lié aux moisissures ({microorganisme})."
            )
        elif microorganisme.lower().startswith("saccharomyces"):
            if product_type == "jus_pomme":
                msg = (
                    "Les conditions de pasteurisation sont suffisantes pour "
                    "réduire le risque lié à Saccharomyces cerevisiae."
                )
            else:
                msg = (
                    f"Les conditions de pasteurisation sont suffisantes pour "
                    f"réduire le risque lié à {microorganisme} et aux reprises de fermentation."
                )
        elif microorganisme:
            msg = (
                f"Les conditions de pasteurisation sont suffisantes pour "
                f"réduire le risque lié à {microorganisme}."
            )
        else:
            msg = f"Pasteurisation conforme. VP = {vp_obtenue:.2f} UP (cible ≥ {cible_int} UP)."

        if statut == "vigilance":
            msg += "\n\nAttention : la marge de sécurité est limitée."
        return msg

    # insuffisant
    if microorganisme.lower().startswith("byssochlamys"):
        if product_type == "jus_pomme":
            return (
                f"Les conditions de pasteurisation sont insuffisantes pour "
                f"réduire le risque lié aux moisissures ({microorganisme}).\n\n"
                f"Il est recommandé d'ajuster le barème de pasteurisation."
            )
        else:
            return (
                f"Les conditions de pasteurisation sont insuffisantes pour "
                f"réduire le risque lié aux moisissures ({microorganisme}) et prévenir une reprise de fermentation.\n\n"
                f"Il est recommandé d'ajuster le barème de pasteurisation."
            )
    elif microorganisme.lower().startswith("saccharomyces"):
        if product_type == "jus_pomme":
            return (
                "Les conditions de pasteurisation sont insuffisantes pour "
                "réduire le risque lié à Saccharomyces cerevisiae.\n\n"
                "Il est recommandé d'ajuster le barème de pasteurisation."
            )
        else:
            return (
                f"Les conditions de pasteurisation sont insuffisantes pour "
                f"réduire le risque lié à {microorganisme} et prévenir une reprise de fermentation.\n\n"
                f"Il est recommandé d'ajuster le barème de pasteurisation."
            )
    elif microorganisme:
        if product_type == "jus_pomme":
            return (
                f"Les conditions de pasteurisation sont insuffisantes pour "
                f"réduire le risque lié à {microorganisme}.\n\n"
                f"Il est recommandé d'ajuster le barème de pasteurisation."
            )
        else:
            return (
                f"Les conditions de pasteurisation sont insuffisantes pour "
                f"réduire le risque lié à {microorganisme} et prévenir une reprise de fermentation.\n\n"
                f"Il est recommandé d'ajuster le barème de pasteurisation."
            )
    return f"Pasteurisation insuffisante. VP = {vp_obtenue:.2f} UP (cible ≥ {cible_int} UP)."


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


def get_specific_diagnostic_message(micro_key: str, statut: str, lang: str = "fr") -> str:
    is_ok = (statut == "conforme")
    key_lower = micro_key.lower()
    if lang == "en":
        if "saccharo" in key_lower:
            return "Pasteurisation conditions are sufficient to reduce risk of re-fermentation and in-bottle overpressure." if is_ok else "Pasteurisation conditions are not sufficient to reduce risk of re-fermentation and in-bottle overpressure."
        elif "ecoli" in key_lower:
            return "Pasteurisation conditions are sufficient to reduce sanitary risk associated with Escherichia coli." if is_ok else "Pasteurisation conditions are not sufficient to reduce sanitary risk associated with Escherichia coli."
        elif "byssochlamys" in key_lower:
            return "Pasteurisation conditions are sufficient to reduce organoleptic and sanitary risks associated with moulds." if is_ok else "Pasteurisation conditions are not sufficient to reduce organoleptic and sanitary risks associated with moulds."
        elif "alicyclo" in key_lower:
            return "Pasteurisation conditions are sufficient to reduce organoleptic risk associated with thermotolerant acidophilic bacteria." if is_ok else "Pasteurisation conditions are not sufficient to reduce organoleptic risk associated with thermotolerant acidophilic bacteria."
        return "Pasteurisation conditions are compliant." if is_ok else "Pasteurisation conditions are insufficient."

    if "saccharo" in key_lower:
        return "Les conditions de pasteurisation sont suffisantes pour réduire le risque lié aux reprises de fermentation et aux surpressions en bouteille." if is_ok else "Les conditions de pasteurisation ne sont pas suffisantes pour réduire le risque lié aux reprises de fermentation et aux surpressions en bouteille."
    elif "ecoli" in key_lower:
        return "Les conditions de pasteurisation sont suffisantes pour réduire le risque sanitaire lié à Escherichia coli." if is_ok else "Les conditions de pasteurisation ne sont pas suffisantes pour réduire le risque sanitaire lié à Escherichia coli."
    elif "byssochlamys" in key_lower:
        return "Les conditions de pasteurisation sont suffisantes pour réduire les risques organoleptique et sanitaire liés aux moisissures." if is_ok else "Les conditions de pasteurisation ne sont pas suffisantes pour réduire les risques organoleptique et sanitaire liés aux moisissures."
    elif "alicyclo" in key_lower:
        return "Les conditions de pasteurisation sont suffisantes pour réduire le risque organoleptique lié aux bactéries acidophiles thermotolérantes." if is_ok else "Les conditions de pasteurisation ne sont pas suffisantes pour réduire le risque organoleptique lié aux bactéries acidophiles thermotolérantes."
    return "Les conditions de pasteurisation sont suffisantes." if is_ok else "Les conditions de pasteurisation ne sont pas suffisantes."


def convertir_temps_en_minutes(temps: List[float], unite_temps: str) -> List[float]:
    """
    Ramène la colonne « temps » en minutes, unité de travail du modèle de Bigelow.

    L'unité vient d'un choix explicite de l'utilisateur et non du procédé :
    un relevé de flash-pasteurisation peut légitimement être noté en minutes
    s'il couvre la montée en température.
    """
    if unite_temps not in UNITES_TEMPS:
        raise ValueError(
            f"Unité de temps inconnue : {unite_temps}. Valeurs acceptées : {', '.join(UNITES_TEMPS)}"
        )
    if unite_temps == "seconde":
        return [t / 60.0 for t in temps]
    return list(temps)


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
    unite_temps: str = "minute",
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
    product_type = normaliser_product_type(product_type)
    produit = PRODUITS.get(product_type)
    if produit is None:
        raise ValueError(f"Type de produit inconnu : {product_type}")

    lang = normalize_locale(locale)
    # L'unité est déclarée par l'utilisateur ; le procédé n'intervient plus dans
    # la conversion, il reste une information de contexte.
    temps_calcul = convertir_temps_en_minutes(temps, unite_temps)

    # --- Évaluation multi-microorganismes pour Jus de pomme ---
    evaluations_multimicro = []
    if product_type == "jus_pomme":
        multimicro_keys = ["saccharo_jus", "ecoli", "byssochlamys_fulva", "alicyclo_std"]
        for key in multimicro_keys:
            m = MICROORGANISMES[key]
            res_m = calculer_vp_bigelow(temperatures, temps_calcul, m["t_ref"], m["z"])
            vp_m = res_m["vp"]
            k_m = round(vp_m / m["d_ref"], 1) if m.get("d_ref") else 0.0
            stat_m = "conforme" if k_m >= 15.0 else "insuffisant"
            msg_m = get_specific_diagnostic_message(key, stat_m, lang)
            evaluations_multimicro.append({
                "key": key,
                "nom": m["nom"],
                "t_ref": m["t_ref"],
                "z": m["z"],
                "d_ref": m["d_ref"],
                "vp": vp_m,
                "k_calc": k_m,
                "statut": stat_m,
                "message": msg_m,
                "courbe": {
                    "temps": temps,
                    "vp_cumulee": res_m["vp_cumulee"]
                }
            })

    # Microorganisme principal / sélectionné
    micro_key = microorganisme or produit["microorganisme_defaut"]
    micro = MICROORGANISMES.get(micro_key)

    effective_t_ref = t_ref if t_ref is not None else (micro["t_ref"] if micro else 60.0)
    effective_z = z if z is not None else (micro["z"] if micro else 7.0)
    effective_vp_cible = vp_cible if vp_cible is not None else (
        micro["vp_cible_min"] if micro else produit["vp_cible_min"]
    )

    result_vp = calculer_vp_bigelow(temperatures, temps_calcul, effective_t_ref, effective_z)
    vp_obtenue = result_vp["vp"]
    result_vp["temps"] = temps

    # --- Diagnostic basé sur k_calc >= 15.0 ---
    d_ref = micro.get("d_ref") if micro else None
    if d_ref and d_ref > 0:
        k_calc = round(vp_obtenue / d_ref, 1)
    else:
        k_calc = round(vp_obtenue / (effective_vp_cible / 5.0), 1) if effective_vp_cible > 0 else 0.0

    statut = "conforme" if k_calc >= 15.0 else "insuffisant"
    message = get_specific_diagnostic_message(micro_key, statut, lang)

    # --- Risque ---
    risque = evaluer_risque(
        vp_obtenue, effective_vp_cible, product_type, micro_key,
        ph=ph, titre_alcool=titre_alcool, locale=lang,
    )

    out = {
        "vp": vp_obtenue,
        "vp_cible": effective_vp_cible,
        "k_calc": k_calc,
        "statut": statut,
        "message": message,
        "risque": risque,
        "parametres": {
            "t_ref": effective_t_ref,
            "z": effective_z,
            "d_ref": micro["d_ref"] if micro else None,
            "microorganisme": micro["nom"] if micro else micro_key,
            "microorganisme_key": micro_key,
            "produit": localize_product_name(product_type, lang),
            "product_type": product_type,
            "unite_temps": unite_temps,
            "unite_temps_nom": localize_unite_temps_name(unite_temps, lang),
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

    if evaluations_multimicro:
        out["evaluations_multimicro"] = evaluations_multimicro

    return out


def _build_conseil(
    niveau: str,
    vp_obtenue: float,
    vp_cible: float,
    produit_nom: str,
    lang: str,
) -> str:
    """Construit un conseil contextuel à partir des données réelles."""
    vp_str = f"{vp_obtenue:.2f}"
    cible_str = f"{vp_cible:.1f}"
    ratio = vp_obtenue / vp_cible if vp_cible > 0 else 0

    if lang == "en":
        if niveau == "faible":
            return (
                f"Treatment validated — the achieved PU ({vp_str} UP) exceeds the "
                f"{cible_str} UP target by a wide margin. {produit_nom} is stabilised."
            )
        if niveau == "modéré":
            return (
                f"The PU reached ({vp_str} UP) meets the {cible_str} UP target but "
                f"with a limited safety margin. Monitor the cold chain for {produit_nom}."
            )
        return (
            f"PU insufficient ({vp_str} UP vs target {cible_str} UP, "
            f"ratio {ratio:.0%}). For {produit_nom}, retreatment or "
            f"an adjustment of the pasteurisation schedule is recommended."
        )
    # Français
    if niveau == "faible":
        return (
            f"Traitement validé — la VP obtenue ({vp_str} UP) dépasse largement "
            f"la cible de {cible_str} UP. {produit_nom} stabilisé."
        )
    if niveau == "modéré":
        return (
            f"VP atteinte ({vp_str} UP) mais marge limitée par rapport à la cible "
            f"({cible_str} UP). Surveillez la chaîne du froid pour {produit_nom}."
        )
    return (
        f"VP insuffisante ({vp_str} UP vs cible {cible_str} UP, "
        f"ratio {ratio:.0%}). Pour {produit_nom}, un retraitement ou "
        f"un ajustement du barème est recommandé."
    )


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
    if normaliser_product_type(product_type) in ("cidre_doux", "jus_pomme"):
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

    # --- Conseil contextuel dynamique ---
    lang = normalize_locale(locale)
    produit_nom = localize_product_name(product_type, lang) or product_type
    conseil = _build_conseil(niveau, vp_obtenue, vp_cible, produit_nom, lang)

    return {
        "niveau": translate("risk_levels", niveau, locale, niveau),
        "score": score,
        "couleur": couleur,
        "conseil": conseil,
    }


# ---------------------------------------------------------------------------
# Aide au choix du barème
# ---------------------------------------------------------------------------
def arrondir_duree(valeur: float, decimales: int) -> float:
    """
    Arrondit une durée sans jamais l'écraser à zéro.

    Le temps de maintien des cidres tombe sous la milliseconde dès 80 °C : un
    arrondi fixe renvoyait 0.0, qui se lit comme « aucun maintien nécessaire »
    au lieu de « très court ». Sous le seuil de l'arrondi demandé, on conserve
    donc trois chiffres significatifs.
    """
    if not math.isfinite(valeur) or valeur <= 0:
        return valeur
    arrondi = round(valeur, decimales)
    return arrondi if arrondi > 0 else float(f"{valeur:.3g}")


def proposer_bareme(
    product_type: str,
    locale: str = "fr",
    microorganisme: Optional[str] = None,
    procede: str = "classique",
) -> Dict:
    """Propose un barème adapté au produit et au microorganisme."""
    product_type = normaliser_product_type(product_type)
    produit = PRODUITS.get(product_type)
    if produit is None:
        raise ValueError(f"Type de produit inconnu : {product_type}")

    micro_key = microorganisme or produit["microorganisme_defaut"]
    micro = MICROORGANISMES.get(micro_key)
    if micro is None:
        raise ValueError(f"Microorganisme inconnu : {micro_key}")

    t_ref = micro["t_ref"]
    z = micro["z"]
    # La VP cible du microorganisme s'applique telle quelle : la majoration de
    # 20 % qui distinguait autrefois les produits troubles a été retirée.
    vp_cible = micro["vp_cible_min"]

    # Propositions de barèmes (température → durée nécessaire en minutes)
    baremes = []
    for temp in [60, 63, 65, 68, 70, 72, 75, 78, 80, 85, 90, 95]:
        l = math.pow(10, (temp - t_ref) / z)
        duree_min = vp_cible / l if l > 0 else float("inf")
        duree_sec = duree_min * 60
        baremes.append({
            "temperature": temp,
            "duree_minutes": arrondir_duree(duree_min, 2),
            "duree_secondes": arrondir_duree(duree_sec, 1),
            "taux_letal": round(l, 4),
        })

    lang = normalize_locale(locale)

    return {
        "produit": localize_product_name(product_type, lang),
        "microorganisme": micro["nom"],
        "t_ref": t_ref,
        "z": z,
        "vp_cible": round(vp_cible, 2),
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


def get_unites_temps(locale: str = "fr") -> List[Dict]:
    lang = normalize_locale(locale)
    return [{"id": key, "nom": localize_unite_temps_name(key, lang)} for key in UNITES_TEMPS]
