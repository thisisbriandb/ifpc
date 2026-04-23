"""
Module Colorimétrie — IFPC

Pipeline : Densité Optique (DO) → Transmittance → XYZ (CIE 1931) → L*a*b* (CIELAB)
Optimiseur : trouve les proportions d'assemblage qui approchent au mieux une cible Lab*.

Références :
- CIE 1931 2° Standard Observer
- Illuminant D65
- Beer-Lambert : pour un mélange en fractions volumiques, DO_mix(λ) = Σ w_i · DO_i(λ)
"""

from __future__ import annotations

import io
import logging
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy.optimize import minimize

logger = logging.getLogger("ifpc.colori")

# ── Tables CIE (Observateur 2°, Illuminant D65) ─────────────────────────────
# Longueurs d'onde 380–780 nm par pas de 10 nm (41 points)

CIE_WAVELENGTHS = np.arange(380, 781, 10, dtype=float)

# CIE 1931 2° Standard Observer — x̄(λ), ȳ(λ), z̄(λ)
X_BAR = np.array([
    0.001368, 0.004243, 0.013438, 0.042853, 0.134380, 0.283900, 0.348280,
    0.336200, 0.290800, 0.195360, 0.095640, 0.032010, 0.004900, 0.009300,
    0.063270, 0.165500, 0.290400, 0.433450, 0.594500, 0.762100, 0.916300,
    1.026300, 1.062200, 1.002600, 0.854450, 0.642400, 0.447900, 0.283500,
    0.164900, 0.087400, 0.046770, 0.022700, 0.011359, 0.005790, 0.002899,
    0.001440, 0.000690, 0.000332, 0.000166, 0.000083, 0.000042,
])

Y_BAR = np.array([
    0.000039, 0.000120, 0.000396, 0.001210, 0.004000, 0.011600, 0.023000,
    0.038000, 0.060000, 0.090980, 0.139020, 0.208020, 0.323000, 0.503000,
    0.710000, 0.862000, 0.954000, 0.994950, 0.995000, 0.952000, 0.870000,
    0.757000, 0.631000, 0.503000, 0.381000, 0.265000, 0.175000, 0.107000,
    0.061000, 0.032000, 0.017000, 0.008210, 0.004102, 0.002091, 0.001047,
    0.000520, 0.000249, 0.000120, 0.000060, 0.000030, 0.000015,
])

Z_BAR = np.array([
    0.006450, 0.020050, 0.067850, 0.207400, 0.645600, 1.385600, 1.747060,
    1.772110, 1.669200, 1.287640, 0.812950, 0.465180, 0.272000, 0.158200,
    0.078250, 0.042160, 0.020300, 0.008750, 0.003900, 0.002100, 0.001650,
    0.001100, 0.000800, 0.000340, 0.000190, 0.000050, 0.000020, 0.000000,
    0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000,
    0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000,
])

# Illuminant D65 — distribution spectrale relative
D65 = np.array([
    49.9755,  54.6482,  82.7549,  91.4860,  93.4318,  86.6823, 104.8650,
    117.0080, 117.8120, 114.8610, 115.9230, 108.8110, 109.3540, 107.8020,
    104.7900, 107.6890, 104.4050, 104.0460, 100.0000,  96.3342,  95.7880,
     88.6856,  90.0062,  89.5991,  87.6987,  83.2886,  83.6992,  80.0268,
     80.2146,  82.2778,  78.2842,  69.7213,  71.6091,  74.3490,  61.6040,
     69.8856,  75.0870,  63.5927,  46.4182,  66.8054,  63.3828,
])

# Blanc de référence D65 (observateur 2°)
XN, YN, ZN = 95.047, 100.000, 108.883

# Constantes CIELAB
EPSILON = 216.0 / 24389.0    # (6/29)^3
KAPPA = 24389.0 / 27.0       # (29/3)^3


# ── Conversion DO → Lab* ────────────────────────────────────────────────────

def do_to_transmittance(do: np.ndarray) -> np.ndarray:
    """Loi de Beer-Lambert : T = 10^(-DO)."""
    return np.power(10.0, -do)


def transmittance_to_xyz(t: np.ndarray) -> Tuple[float, float, float]:
    """Transmittance → XYZ via intégration pondérée par l'illuminant D65 et l'observateur 2°."""
    sy = D65 * Y_BAR
    k = 100.0 / sy.sum()
    x = k * np.sum(D65 * t * X_BAR)
    y = k * np.sum(D65 * t * Y_BAR)
    z = k * np.sum(D65 * t * Z_BAR)
    return float(x), float(y), float(z)


def _f_lab(t: float) -> float:
    """Fonction CIELAB : racine cubique avec correction linéaire près de 0."""
    if t > EPSILON:
        return t ** (1.0 / 3.0)
    return (KAPPA * t + 16.0) / 116.0


def xyz_to_lab(x: float, y: float, z: float) -> Tuple[float, float, float]:
    """XYZ → L*a*b* (référence D65)."""
    fx = _f_lab(x / XN)
    fy = _f_lab(y / YN)
    fz = _f_lab(z / ZN)
    L = 116.0 * fy - 16.0
    a = 500.0 * (fx - fy)
    b = 200.0 * (fy - fz)
    return L, a, b


def do_to_lab(do: np.ndarray) -> Tuple[float, float, float]:
    """Pipeline complet : DO (sur les longueurs d'onde CIE) → Lab*."""
    t = do_to_transmittance(do)
    x, y, z = transmittance_to_xyz(t)
    return xyz_to_lab(x, y, z)


def lab_to_rgb_hex(L: float, a: float, b: float) -> str:
    """Convertit un Lab* en couleur hexadécimale sRGB pour l'affichage."""
    fy = (L + 16.0) / 116.0
    fx = a / 500.0 + fy
    fz = fy - b / 200.0

    def finv(f: float) -> float:
        f3 = f ** 3
        return f3 if f3 > EPSILON else (116.0 * f - 16.0) / KAPPA

    x = XN * finv(fx) / 100.0
    y = YN * finv(fy) / 100.0
    z = ZN * finv(fz) / 100.0

    # XYZ (D65) → RGB linéaire (matrice sRGB)
    r = x *  3.2404542 + y * -1.5371385 + z * -0.4985314
    g = x * -0.9692660 + y *  1.8760108 + z *  0.0415560
    b_ = x *  0.0556434 + y * -0.2040259 + z *  1.0572252

    def gamma(c: float) -> float:
        c = max(0.0, min(1.0, c))
        return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1.0 / 2.4)) - 0.055

    rgb = [int(round(gamma(c) * 255.0)) for c in (r, g, b_)]
    return "#{:02x}{:02x}{:02x}".format(*rgb)


# ── Parsing des fichiers de spectres ────────────────────────────────────────

def parse_spectra_file(content: bytes, filename: str) -> Tuple[np.ndarray, List[str], np.ndarray]:
    """
    Lit un fichier CSV/Excel. Attend :
    - Colonne 1 : longueur d'onde (nm)
    - Colonnes suivantes : DO de chaque cuvée (en-tête = nom de cuvée)

    Retourne (wavelengths, cuvee_names, do_matrix[n_wavelengths, n_cuves]).
    """
    buf = io.BytesIO(content)
    if filename.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(buf)
    else:
        # essai plusieurs séparateurs
        text = content.decode("utf-8-sig", errors="replace")
        for sep in [",", ";", "\t"]:
            try:
                df = pd.read_csv(io.StringIO(text), sep=sep)
                if df.shape[1] >= 2:
                    break
            except Exception:
                continue
        else:
            raise ValueError("Impossible de lire le CSV : vérifiez le séparateur.")

    if df.shape[1] < 2:
        raise ValueError("Le fichier doit contenir au moins 2 colonnes : longueur d'onde + au moins une cuvée.")

    # Nettoyage : convertir en float, drop NaN sur la première colonne
    df = df.apply(pd.to_numeric, errors="coerce")
    df = df.dropna(subset=[df.columns[0]])

    wl = df.iloc[:, 0].to_numpy(dtype=float)
    do = df.iloc[:, 1:].to_numpy(dtype=float)
    names = [str(c) for c in df.columns[1:]]

    # Trie par longueur d'onde croissante
    order = np.argsort(wl)
    wl = wl[order]
    do = do[order, :]

    # Remplace les NaN restants dans les DO par 0
    do = np.nan_to_num(do, nan=0.0)

    return wl, names, do


def resample_to_cie(wl: np.ndarray, do_matrix: np.ndarray) -> np.ndarray:
    """Interpole les spectres sur la grille CIE (380-780 nm, pas de 10 nm)."""
    out = np.zeros((len(CIE_WAVELENGTHS), do_matrix.shape[1]))
    for i in range(do_matrix.shape[1]):
        out[:, i] = np.interp(CIE_WAVELENGTHS, wl, do_matrix[:, i], left=0.0, right=0.0)
    return out


# ── Optimisation de l'assemblage ────────────────────────────────────────────

def delta_e_76(lab1: Tuple[float, float, float], lab2: Tuple[float, float, float]) -> float:
    """ΔE CIE 1976 (distance euclidienne dans Lab*). Conservé pour référence."""
    return float(np.sqrt(sum((a - b) ** 2 for a, b in zip(lab1, lab2))))


def delta_e_2000(
    lab1: Tuple[float, float, float],
    lab2: Tuple[float, float, float],
    kL: float = 1.0, kC: float = 1.0, kH: float = 1.0,
) -> float:
    """
    ΔE CIE 2000 (ΔE₀₀) — norme colorimétrique industrielle actuelle.
    Prend en compte la non-linéarité de la perception humaine sur les axes L, C, H.
    """
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    # Étape 1 — chroma originales et compensation de faible chroma
    C1 = np.hypot(a1, b1)
    C2 = np.hypot(a2, b2)
    C_bar = (C1 + C2) / 2.0
    G = 0.5 * (1.0 - np.sqrt(C_bar ** 7 / (C_bar ** 7 + 25.0 ** 7)))

    a1p = (1.0 + G) * a1
    a2p = (1.0 + G) * a2
    C1p = np.hypot(a1p, b1)
    C2p = np.hypot(a2p, b2)

    # Étape 2 — teintes (en degrés)
    def _hue(ap: float, bp: float) -> float:
        if ap == 0.0 and bp == 0.0:
            return 0.0
        h = np.degrees(np.arctan2(bp, ap))
        return h + 360.0 if h < 0.0 else h

    h1p = _hue(a1p, b1)
    h2p = _hue(a2p, b2)

    # Étape 3 — deltas
    dLp = L2 - L1
    dCp = C2p - C1p

    if C1p * C2p == 0.0:
        dhp = 0.0
    else:
        diff = h2p - h1p
        if diff > 180.0:   diff -= 360.0
        elif diff < -180.0: diff += 360.0
        dhp = diff

    dHp = 2.0 * np.sqrt(C1p * C2p) * np.sin(np.radians(dhp / 2.0))

    # Étape 4 — moyennes
    L_bar = (L1 + L2) / 2.0
    Cp_bar = (C1p + C2p) / 2.0

    if C1p * C2p == 0.0:
        h_bar = h1p + h2p
    else:
        s = h1p + h2p
        d = abs(h1p - h2p)
        if d <= 180.0:
            h_bar = s / 2.0
        else:
            h_bar = (s + 360.0) / 2.0 if s < 360.0 else (s - 360.0) / 2.0

    # Étape 5 — facteurs de pondération
    T = (1.0
         - 0.17 * np.cos(np.radians(h_bar - 30.0))
         + 0.24 * np.cos(np.radians(2.0 * h_bar))
         + 0.32 * np.cos(np.radians(3.0 * h_bar + 6.0))
         - 0.20 * np.cos(np.radians(4.0 * h_bar - 63.0)))

    dTheta = 30.0 * np.exp(-(((h_bar - 275.0) / 25.0) ** 2))
    Rc = 2.0 * np.sqrt(Cp_bar ** 7 / (Cp_bar ** 7 + 25.0 ** 7))
    Sl = 1.0 + (0.015 * (L_bar - 50.0) ** 2) / np.sqrt(20.0 + (L_bar - 50.0) ** 2)
    Sc = 1.0 + 0.045 * Cp_bar
    Sh = 1.0 + 0.015 * Cp_bar * T
    Rt = -np.sin(np.radians(2.0 * dTheta)) * Rc

    # Étape 6 — ΔE₀₀
    term_L = dLp / (kL * Sl)
    term_C = dCp / (kC * Sc)
    term_H = dHp / (kH * Sh)
    de = np.sqrt(term_L ** 2 + term_C ** 2 + term_H ** 2 + Rt * term_C * term_H)
    return float(de)


def find_best_blend(
    do_cie: np.ndarray,
    target_lab: Tuple[float, float, float],
) -> Tuple[np.ndarray, Tuple[float, float, float], float]:
    """
    Trouve les proportions w_i (somme = 1, w_i ∈ [0,1]) minimisant ΔE
    entre le mélange et la cible.

    Retourne (weights, lab_obtenu, delta_e).
    """
    n = do_cie.shape[1]

    def lab_of(weights: np.ndarray) -> Tuple[float, float, float]:
        do_mix = do_cie @ weights
        return do_to_lab(do_mix)

    def objective(weights: np.ndarray) -> float:
        lab = lab_of(weights)
        return delta_e_2000(lab, target_lab) ** 2  # carré pour gradient plus lisse

    # Point de départ uniforme
    w0 = np.full(n, 1.0 / n)
    bounds = [(0.0, 1.0)] * n
    constraints = [{"type": "eq", "fun": lambda w: w.sum() - 1.0}]

    best_w = w0
    best_de = float("inf")
    # Plusieurs démarrages aléatoires pour éviter les minima locaux
    rng = np.random.default_rng(42)
    starts = [w0] + [rng.dirichlet(np.ones(n)) for _ in range(6)]

    for start in starts:
        try:
            res = minimize(
                objective, start, method="SLSQP",
                bounds=bounds, constraints=constraints,
                options={"ftol": 1e-10, "maxiter": 200},
            )
            if res.success or res.fun < 1e4:
                lab = lab_of(res.x)
                de = delta_e_2000(lab, target_lab)
                if de < best_de:
                    best_de = de
                    best_w = res.x
        except Exception as e:
            logger.debug(f"SLSQP start failed: {e}")
            continue

    # Normalisation finale (clamp + renorm pour assurer sum=1)
    best_w = np.clip(best_w, 0.0, 1.0)
    s = best_w.sum()
    if s > 0:
        best_w = best_w / s

    lab_final = lab_of(best_w)
    de_final = delta_e_2000(lab_final, target_lab)
    return best_w, lab_final, de_final


# ── API publique du module ──────────────────────────────────────────────────

def assembler(
    file_content: bytes,
    filename: str,
    target_L: float,
    target_a: float,
    target_b: float,
    volume_total: float = 1000.0,
) -> dict:
    """
    Entrée principale du module. Lit le fichier, calcule les Lab* de chaque cuvée,
    optimise le mélange, retourne le résultat sérialisable.

    volume_total : volume final souhaité en litres (pour la répartition pratique).
    """
    wl, names, do_matrix = parse_spectra_file(file_content, filename)

    if len(wl) < 10:
        raise ValueError("Spectre trop court : au moins 10 points sont nécessaires.")

    do_cie = resample_to_cie(wl, do_matrix)
    n_cuves = do_cie.shape[1]

    # Lab* de chaque cuvée seule
    cuves_info = []
    for i in range(n_cuves):
        L, a, b = do_to_lab(do_cie[:, i])
        cuves_info.append({
            "nom": names[i],
            "L": round(L, 2),
            "a": round(a, 2),
            "b": round(b, 2),
            "hex": lab_to_rgb_hex(L, a, b),
        })

    target_lab = (float(target_L), float(target_a), float(target_b))
    weights, lab_obtenu, de = find_best_blend(do_cie, target_lab)

    # Spectre DO du mélange final (pour le graphique — on garde la grille utilisateur)
    do_mix_user = do_matrix @ weights
    spectre = {
        "wavelengths": wl.tolist(),
        "do_mix": do_mix_user.tolist(),
        "do_cuves": [do_matrix[:, i].tolist() for i in range(n_cuves)],
    }

    volume_total = max(0.0, float(volume_total))
    proportions = [
        {
            "nom": names[i],
            "pct": round(float(weights[i]) * 100.0, 1),
            "litres": round(float(weights[i]) * volume_total, 1),
        }
        for i in range(n_cuves)
    ]

    return {
        "cible": {
            "L": round(target_lab[0], 2),
            "a": round(target_lab[1], 2),
            "b": round(target_lab[2], 2),
            "hex": lab_to_rgb_hex(*target_lab),
        },
        "obtenu": {
            "L": round(lab_obtenu[0], 2),
            "a": round(lab_obtenu[1], 2),
            "b": round(lab_obtenu[2], 2),
            "hex": lab_to_rgb_hex(*lab_obtenu),
        },
        "delta_e": round(de, 2),
        "delta_e_method": "CIEDE2000",
        "volume_total": volume_total,
        "proportions": proportions,
        "cuves": cuves_info,
        "spectre": spectre,
    }
