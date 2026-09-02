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

# « alicyclo_res » annonçait une souche résistante d'Alicyclobacillus, mais
# portait les paramètres exacts de « alicyclo_std » et ne correspond à aucune
# ligne du tableau transmis par la R&D — qui ne connaît qu'un Alicyclobacillus.
# L'entrée est retirée du référentiel ; la clé reste acceptée en entrée, les
# analyses enregistrées la portant continuent d'être relues correctement.
ALIAS_MICROORGANISMES: Dict[str, str] = {
    "alicyclo_res": "alicyclo_std",
}


def normaliser_product_type(product_type: str) -> str:
    """Ramène un type de produit hérité vers l'entrée qui l'a absorbé."""
    return ALIAS_PRODUITS.get(product_type, product_type)


def normaliser_microorganisme(cle: Optional[str]) -> Optional[str]:
    """Ramène une clé de microorganisme héritée vers l'entrée qui l'a absorbée."""
    if cle is None:
        return None
    return ALIAS_MICROORGANISMES.get(cle, cle)


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


def transposer_d_ref(
    d_ref: Optional[float],
    t_ref_mesure: float,
    t_ref_retenu: float,
    z: float,
) -> Optional[float]:
    """Ramène un temps de réduction décimale à une autre température de référence.

    Le D suit la même loi que le taux létal : D(T) = D(Tref) × 10^((Tref − T)/z).

    La transposition est indispensable au critère de conformité k = VP / D : les
    deux termes doivent se rapporter à la même température. La VP est calculée
    au Tref retenu, le D de la table est mesuré au Tref du microorganisme. Sans
    transposition, un expert qui saisit 72 °C sur une souche tabulée à 60 °C
    avec z = 4 obtenait un k faussé d'un facteur 10^((60−72)/4) = 1000, et le
    même traitement basculait de « conforme » à « insuffisant » selon la
    référence choisie — alors que le résultat physique est invariant.

    Renvoie None quand la transposition n'est pas exploitable : mieux vaut ne
    pas statuer que statuer sur un rapport qui n'a plus de sens.
    """
    if not d_ref or d_ref <= 0 or z <= 0:
        return None
    try:
        d_transpose = d_ref * math.pow(10.0, (t_ref_mesure - t_ref_retenu) / z)
    except OverflowError:
        return None
    if not math.isfinite(d_transpose) or d_transpose <= 0:
        return None
    return d_transpose


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
    #
    # Un produit évalué sur plusieurs cibles se juge sur son facteur limitant —
    # la cible la plus difficile à atteindre, c'est-à-dire celle dont le facteur
    # de réduction k est le plus faible. C'est la règle du référentiel
    # (referentiel-scientifique.md §5) et c'est déjà celle qu'applique l'aide au barème.
    # Sans elle, un jus traité 30 min à 95 °C était archivé « conforme » sur la
    # foi de Byssochlamys alors qu'Alicyclobacillus n'atteignait que k = 1,1.
    #
    # Un expert qui désigne une cible ou impose Tref/z reprend la main : c'est
    # alors son choix qui porte la VP, la courbe et le message.
    choix_explicite = microorganisme is not None or t_ref is not None or z is not None
    if evaluations_multimicro and not choix_explicite:
        micro_key = min(evaluations_multimicro, key=lambda e: e["k_calc"])["key"]
    else:
        micro_key = normaliser_microorganisme(microorganisme) or produit["microorganisme_defaut"]
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
    # Le D est ramené au Tref effectivement retenu : hors mode expert la
    # transposition vaut 1 et ne change rien, mais elle rend k invariant par
    # changement de température de référence, ce qu'il doit être.
    d_ref = micro.get("d_ref") if micro else None
    d_effectif = (
        transposer_d_ref(d_ref, micro["t_ref"], effective_t_ref, effective_z)
        if micro else None
    )
    if d_effectif:
        k_calc = round(vp_obtenue / d_effectif, 1)
    else:
        k_calc = round(vp_obtenue / (effective_vp_cible / 5.0), 1) if effective_vp_cible > 0 else 0.0

    statut = "conforme" if k_calc >= 15.0 else "insuffisant"

    # Le verdict porte sur le produit, pas sur une seule cible : il suit la plus
    # défavorable de toutes les évaluations présentées à l'opérateur. En mode
    # standard le principal est déjà le facteur limitant et la boucle ne change
    # rien ; en mode expert, elle empêche qu'une cible affichée « insuffisant »
    # coexiste avec un enregistrement « conforme ».
    facteur_limitant = {
        "key": micro_key,
        "nom": micro["nom"] if micro else micro_key,
        "k_calc": k_calc,
        "statut": statut,
    }
    for evaluation in evaluations_multimicro:
        if evaluation["k_calc"] < facteur_limitant["k_calc"]:
            facteur_limitant = {
                "key": evaluation["key"],
                "nom": evaluation["nom"],
                "k_calc": evaluation["k_calc"],
                "statut": evaluation["statut"],
            }

    statut = facteur_limitant["statut"]
    message = get_specific_diagnostic_message(facteur_limitant["key"], statut, lang)

    out = {
        "vp": vp_obtenue,
        "vp_cible": effective_vp_cible,
        "k_calc": k_calc,
        "statut": statut,
        "message": message,
        "parametres": {
            "t_ref": effective_t_ref,
            "z": effective_z,
            # Le D affiché accompagne le Tref affiché : c'est le D transposé,
            # sans quoi la fiche annoncerait « Tref 72 °C ; D 1,1 min » alors
            # que ce D est mesuré à 60 °C.
            "d_ref": arrondir_duree(d_effectif, 6) if d_effectif else d_ref,
            "microorganisme": micro["nom"] if micro else micro_key,
            "microorganisme_key": micro_key,
            "produit": localize_product_name(product_type, lang),
            "product_type": product_type,
            "unite_temps": unite_temps,
            "unite_temps_nom": localize_unite_temps_name(unite_temps, lang),
            "procede": localize_procede_name(procede, lang),
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
        out["facteur_limitant"] = facteur_limitant

    return out


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

    micro_key = normaliser_microorganisme(microorganisme) or produit["microorganisme_defaut"]
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
