from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import io
import csv
import re
import logging
import pandas as pd
import pasto
import colori
from auth import get_optional_user, verify_advanced_access

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ifpc")

app = FastAPI(
    title="IFPC Pasteurization API",
    description="API pour l'évaluation et le pilotage de la pasteurisation cidricole",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Modèles Pydantic ────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    temperatures: List[float]
    temps: List[float]
    product_type: str = "jus_pomme"
    locale: str = "fr"
    microorganisme: Optional[str] = None
    t_ref: Optional[float] = None
    z: Optional[float] = None
    vp_cible: Optional[float] = None
    clarification: Optional[str] = None
    procede: Optional[str] = None
    ph: Optional[float] = None
    titre_alcool: Optional[float] = None


class BaremeRequest(BaseModel):
    product_type: str = "jus_pomme"
    locale: str = "fr"
    microorganisme: Optional[str] = None
    clarification: str = "trouble"
    procede: str = "classique"

class AssemblageDbRequest(BaseModel):
    wavelengths: list
    names: list
    do_matrix_list: list
    target_L: float
    target_a: float
    target_b: float
    volume_total: float = 1000.0


class PasteDataRequest(BaseModel):
    raw_text: str
    product_type: str = "jus_pomme"
    locale: str = "fr"
    microorganisme: Optional[str] = None
    t_ref: Optional[float] = None
    z: Optional[float] = None
    vp_cible: Optional[float] = None
    clarification: Optional[str] = None
    procede: Optional[str] = None
    ph: Optional[float] = None
    titre_alcool: Optional[float] = None


# ── Référentiels ─────────────────────────────────────────────────────────────

@app.get("/api/referentiels/produits")
async def get_produits(locale: str = "fr"):
    return pasto.get_produits(locale)


@app.get("/api/referentiels/microorganismes")
async def get_microorganismes(locale: str = "fr"):
    return pasto.get_microorganismes(locale)


@app.get("/api/referentiels/procedes")
async def get_procedes(locale: str = "fr"):
    return pasto.get_procedes(locale)


@app.get("/api/referentiels/clarifications")
async def get_clarifications(locale: str = "fr"):
    return pasto.get_clarifications(locale)


# ── Module 1 : Contrôle de pasteurisation ────────────────────────────────────

@app.post("/api/pasteurisation/evaluer")
async def evaluer_pasteurisation(
    request: EvaluateRequest,
    user: Optional[dict] = Depends(get_optional_user)
):
    """Évalue un cycle de pasteurisation à partir de données température/temps."""
    try:
        verify_advanced_access(user, request.t_ref, request.z, request.microorganisme)
        result = pasto.evaluer_pasteurisation(
            temperatures=request.temperatures,
            temps=request.temps,
            product_type=request.product_type,
            locale=request.locale,
            t_ref=request.t_ref,
            z=request.z,
            vp_cible=request.vp_cible,
            microorganisme=request.microorganisme,
            clarification=request.clarification,
            procede=request.procede,
            ph=request.ph,
            titre_alcool=request.titre_alcool,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/pasteurisation/upload")
async def upload_file(
    file: UploadFile = File(...),
    product_type: str = "jus_pomme",
    locale: str = "fr",
    microorganisme: Optional[str] = None,
    t_ref: Optional[float] = None,
    z: Optional[float] = None,
    vp_cible: Optional[float] = None,
    clarification: Optional[str] = None,
    procede: Optional[str] = None,
    ph: Optional[float] = None,
    titre_alcool: Optional[float] = None,
    user: Optional[dict] = Depends(get_optional_user)
):
    """Upload un fichier Excel (.xlsx) ou CSV et évalue la pasteurisation."""
    try:
        verify_advanced_access(user, t_ref, z, microorganisme)
        content = await file.read()
        filename = file.filename or ""

        if filename.endswith((".xlsx", ".xls")):
            df = _read_excel_robust(content, filename)
            temps_list, temp_list = _extract_numeric_columns(df)
        elif filename.endswith(".csv") or filename.endswith(".txt") or filename.endswith(".tsv"):
            # Tenter d'abord le format enregistreur (DS1922E, etc.) qui a des
            # en-têtes métadonnées avant la table de données
            text = _decode_bytes(content)
            lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
            logger_rows = _try_parse_logger_format(lines)
            if logger_rows is not None and len(logger_rows) >= 2:
                logger.info(f"Format enregistreur détecté (upload), {len(logger_rows)} lignes")
                temps_list, temp_list = _datetime_rows_to_minutes(logger_rows)
            else:
                df = _read_csv_robust(content)
                temps_list, temp_list = _extract_numeric_columns(df)
        else:
            raise HTTPException(
                status_code=400,
                detail="Format non supporté. Utilisez .xlsx, .xls, .csv ou .txt",
            )

        result = pasto.evaluer_pasteurisation(
            temperatures=temp_list,
            temps=temps_list,
            product_type=product_type,
            locale=locale,
            t_ref=t_ref,
            z=z,
            vp_cible=vp_cible,
            microorganisme=microorganisme,
            clarification=clarification,
            procede=procede,
            ph=ph,
            titre_alcool=titre_alcool,
        )
        result["fichier"] = filename
        result["nb_points"] = len(temp_list)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Erreur upload: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier : {e}")


@app.post("/api/pasteurisation/coller")
async def paste_data(
    request: PasteDataRequest,
    user: Optional[dict] = Depends(get_optional_user)
):
    """Évalue à partir de données collées (copier-coller depuis tableur)."""
    try:
        verify_advanced_access(user, request.t_ref, request.z, request.microorganisme)
        logger.info("=== /coller reçu ===")
        logger.info(f"product_type={request.product_type}, t_ref={request.t_ref}, z={request.z}")
        logger.info(f"raw_text ({len(request.raw_text)} chars), premières lignes:")
        for i, line in enumerate(request.raw_text.split('\n')[:5]):
            logger.info(f"  [{i}] {line!r}")
        temps_list, temp_list = _parse_pasted_text(request.raw_text)
        logger.info(f"Parse OK : {len(temps_list)} points")
        logger.info(f"  temps[:5]  = {temps_list[:5]}")
        logger.info(f"  temp[:5]   = {temp_list[:5]}")
        logger.info(f"  temps[-3:] = {temps_list[-3:]}")
        logger.info(f"  temp[-3:]  = {temp_list[-3:]}")
        result = pasto.evaluer_pasteurisation(
            temperatures=temp_list,
            temps=temps_list,
            product_type=request.product_type,
            locale=request.locale,
            t_ref=request.t_ref,
            z=request.z,
            vp_cible=request.vp_cible,
            microorganisme=request.microorganisme,
            clarification=request.clarification,
            procede=request.procede,
            ph=request.ph,
            titre_alcool=request.titre_alcool,
        )
        result["nb_points"] = len(temp_list)
        logger.info(f"Résultat: VP={result['vp']} UP, statut={result['statut']}, vp_cible={result['vp_cible']}")
        return result
    except ValueError as e:
        logger.error(f"/coller ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"/coller Exception inattendue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Module 2 : Aide au choix du barème ───────────────────────────────────────

@app.post("/api/bareme/proposer")
async def proposer_bareme(request: BaremeRequest):
    """Propose des barèmes adaptés au produit et microorganisme."""
    try:
        return pasto.proposer_bareme(
            product_type=request.product_type,
            locale=request.locale,
            microorganisme=request.microorganisme,
            clarification=request.clarification,
            procede=request.procede,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Module 3 : Colorimétrie — Assemblage ─────────────────────────────────────

@app.post("/api/colorimetrie/assemblage")
async def colorimetrie_assemblage(
    file: UploadFile = File(...),
    target_L: float = 0.0,
    target_a: float = 0.0,
    target_b: float = 0.0,
    volume_total: float = 1000.0,
    user: Optional[dict] = Depends(get_optional_user),
):
    """
    Calcule les proportions optimales d'assemblage pour atteindre une couleur L*a*b* cible.

    Upload d'un fichier CSV/Excel avec :
    - Colonne 1 : longueur d'onde (nm)
    - Colonnes suivantes : DO de chaque cuvée
    """
    try:
        content = await file.read()
        filename = file.filename or "spectres.csv"
        result = colori.assembler(
            file_content=content,
            filename=filename,
            target_L=target_L,
            target_a=target_a,
            target_b=target_b,
            volume_total=volume_total,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Erreur assemblage: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur de traitement : {e}")

@app.post("/api/colorimetrie/assemblage-db")
async def colorimetrie_assemblage_db(
    request: AssemblageDbRequest,
    user: Optional[dict] = Depends(get_optional_user),
):
    """
    Calcule les proportions optimales d'assemblage à partir de données de spectres déjà extraites (DB).
    """
    try:
        result = colori.assembler_donnees(
            wavelengths=request.wavelengths,
            names=request.names,
            do_matrix_list=request.do_matrix_list,
            target_L=request.target_L,
            target_a=request.target_a,
            target_b=request.target_b,
            volume_total=request.volume_total,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Erreur assemblage-db: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur de calcul : {e}")


# ── Utilitaires ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "IFPC Pasteurization API",
        "version": "2.0.0",
        "modules": {
            "controle": "/api/pasteurisation/evaluer",
            "upload": "/api/pasteurisation/upload",
            "coller": "/api/pasteurisation/coller",
            "bareme": "/api/bareme/proposer",
            "referentiels": "/api/referentiels/",
        },
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ── Helpers privés ───────────────────────────────────────────────────────────

def _decode_bytes(content: bytes) -> str:
    """Décode des bytes en essayant plusieurs encodages courants."""
    for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252", "iso-8859-1"]:
        try:
            return content.decode(encoding)
        except (UnicodeDecodeError, ValueError):
            continue
    return content.decode("utf-8", errors="replace")


def _read_excel_robust(content: bytes, filename: str) -> pd.DataFrame:
    """Lecture robuste d'un fichier Excel avec gestion d'erreurs détaillée.
    
    Gère les fichiers enregistreur (DS1922E, etc.) qui ont des lignes de
    métadonnées avant le vrai tableau de données. Scanne pour trouver la
    ligne d'en-tête contenant 'Date/Heure' et 'Température'.
    """
    try:
        df_raw = pd.read_excel(io.BytesIO(content), engine="openpyxl", header=None)
    except Exception as e1:
        raise ValueError(
            f"Impossible de lire le fichier Excel '{filename}'. "
            f"Vérifiez que le fichier n'est pas corrompu. Détail : {e1}"
        )
    if df_raw.empty:
        raise ValueError("Le fichier Excel est vide.")

    # Scan rows to find the real header containing date+temperature keywords
    header_row_idx = None
    for i, row in df_raw.iterrows():
        row_text = " ".join(str(v).lower() for v in row.values if pd.notna(v))
        has_date = any(k in row_text for k in ["date", "heure", "hour", "time"])
        has_temp = any(k in row_text for k in ["temp", "°c", "celsius"])
        if has_date and has_temp:
            header_row_idx = i
            logger.info(f"En-tête données trouvé à la ligne {i}: {list(row.values)}")
            break

    if header_row_idx is not None:
        # Re-read with the correct header row
        df = pd.read_excel(
            io.BytesIO(content), engine="openpyxl",
            header=header_row_idx,
        )
        # Drop any rows that are all NaN
        df = df.dropna(how="all")
        logger.info(f"Excel relu avec en-tête ligne {header_row_idx}: colonnes={list(df.columns)}, {len(df)} lignes")
        return df

    # Fallback: try standard read with first row as header
    try:
        df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    except Exception:
        df = df_raw
        df.columns = [f"col_{i}" for i in range(len(df.columns))]

    if df.empty:
        raise ValueError("Le fichier Excel est vide.")
    logger.info(f"Excel standard: colonnes={list(df.columns)}, {len(df)} lignes")
    return df


def _read_csv_robust(content: bytes) -> pd.DataFrame:
    """Lecture robuste d'un fichier CSV avec détection d'encodage et séparateur."""
    text = _decode_bytes(content)
    first_line = text.split("\n")[0] if text else ""
    if "\t" in first_line:
        sep = "\t"
    elif ";" in first_line:
        sep = ";"
    else:
        sep = ","
    try:
        df = pd.read_csv(io.StringIO(text), sep=sep, engine="python", on_bad_lines="skip")
    except Exception:
        df = pd.read_csv(io.StringIO(text), sep=sep, header=None, engine="python", on_bad_lines="skip")
    if df.empty:
        raise ValueError("Le fichier CSV est vide ou illisible.")
    return df


def _clean_numeric(val) -> Optional[float]:
    """Convertit une valeur en float, en gérant virgules décimales, espaces, unités."""
    if isinstance(val, (int, float)):
        if pd.isna(val):
            return None
        return float(val)
    if not isinstance(val, str):
        return None
    s = str(val).strip().strip('"').strip()
    s = re.sub(r'[°CcFf\s]+$', '', s).strip()
    s = s.replace(" ", "")
    s = s.replace(",", ".")
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _detect_columns(df: pd.DataFrame):
    """Détecte automatiquement les colonnes temps et température."""
    cols_lower = {c: str(c).lower().strip() for c in df.columns}

    temps_col = None
    temp_col = None

    TIME_KEYWORDS = ["temps", "time", "minute", "min", "sec", "durée", "duree",
                     "dur\xe9e", "dur e", "heure", "hour", "date"]
    TEMP_KEYWORDS = ["temp", "°c", "degre", "degree", "celsius", "temperature",
                     "température", "temp\xe9rature"]

    for orig, low in cols_lower.items():
        if any(k in low for k in TIME_KEYWORDS):
            temps_col = orig
        if any(k in low for k in TEMP_KEYWORDS):
            if temp_col is None:
                temp_col = orig

    # Fallback : première colonne = temps, deuxième = température
    if temps_col is None and temp_col is None and len(df.columns) >= 2:
        temps_col = df.columns[0]
        temp_col = df.columns[1]
    elif temps_col is None or temp_col is None:
        raise ValueError(
            f"Impossible de détecter les colonnes. Colonnes trouvées : {list(df.columns)}. "
            "Nommez-les 'temps' et 'temperature'."
        )

    return temps_col, temp_col


def _extract_numeric_columns(df: pd.DataFrame):
    """Extrait deux listes numériques (temps, température) d'un DataFrame.
    
    Gère le cas où la colonne temps contient des datetime/Timestamp :
    les convertit automatiquement en minutes écoulées depuis le premier point.
    """
    from datetime import datetime as _dt
    temps_col, temp_col = _detect_columns(df)
    logger.info(f"Colonnes détectées: temps='{temps_col}', temp='{temp_col}'")

    # Check if time column contains datetime objects
    time_is_datetime = False
    for val in df[temps_col].dropna().head(5):
        if isinstance(val, (_dt, pd.Timestamp)):
            time_is_datetime = True
            break

    if time_is_datetime:
        logger.info("Colonne temps contient des dates/heures → conversion en minutes écoulées")
        datetime_rows = []
        skipped = 0
        for idx, row in df.iterrows():
            t_raw = row[temps_col]
            temp_val = _clean_numeric(row[temp_col])
            if temp_val is None:
                skipped += 1
                continue
            if isinstance(t_raw, (_dt, pd.Timestamp)):
                datetime_rows.append((t_raw, temp_val))
            elif isinstance(t_raw, str):
                try:
                    dt_parsed = _parse_french_datetime(t_raw)
                    datetime_rows.append((dt_parsed, temp_val))
                except ValueError:
                    skipped += 1
            else:
                skipped += 1

        if skipped > 0:
            logger.info(f"{skipped} ligne(s) ignorée(s)")
        if len(datetime_rows) < 2:
            raise ValueError(
                f"Pas assez de données exploitables ({len(datetime_rows)} point(s)). "
                f"Vérifiez les colonnes temps='{temps_col}' et température='{temp_col}'."
            )
        return _datetime_rows_to_minutes(datetime_rows)

    # Standard numeric columns
    temps_list = []
    temp_list = []
    skipped = 0

    for idx, row in df.iterrows():
        t_val = _clean_numeric(row[temps_col])
        temp_val = _clean_numeric(row[temp_col])
        if t_val is not None and temp_val is not None:
            temps_list.append(t_val)
            temp_list.append(temp_val)
        else:
            skipped += 1

    if skipped > 0:
        logger.info(f"{skipped} ligne(s) ignorée(s) (non numériques ou en-tête)")

    if len(temps_list) < 2:
        raise ValueError(
            f"Pas assez de données numériques exploitables (seulement {len(temps_list)} point(s) trouvé(s)). "
            f"Colonnes détectées : temps='{temps_col}', température='{temp_col}'. "
            f"Vérifiez que votre fichier contient au moins 2 lignes de données avec "
            f"des valeurs numériques dans ces colonnes."
        )

    return temps_list, temp_list


def _parse_pasted_text(raw_text: str):
    """Parse du texte collé en listes temps (minutes) / température (°C).

    Gère :
    - Format simple : deux colonnes numériques (temps, température)
    - Format enregistreur (DS1922E, etc.) : en-têtes métadonnées, colonnes
      "Date / Heure" + "Température (°C)", dates françaises, champs CSV entre
      guillemets.
    """
    # Nettoyer les caractères problématiques d'encodage
    raw_text = raw_text.replace('\ufffd', '').replace('\x00', '')

    lines = [l.strip() for l in raw_text.strip().split("\n") if l.strip()]
    if len(lines) < 2:
        raise ValueError(
            "Il faut au moins 2 lignes de données.\n"
            "Format attendu :\n"
            "  Temps (min)    Température (°C)\n"
            "  0              20\n"
            "  1              45\n"
            "  2              68"
        )

    # ── 1. Tentative format enregistreur (CSV avec dates) ──────────────
    datetime_rows = _try_parse_logger_format(lines)
    if datetime_rows is not None and len(datetime_rows) >= 2:
        logger.info(f"Format enregistreur détecté, {len(datetime_rows)} lignes datetime")
        logger.debug(f"  1ère ligne: {datetime_rows[0]}")
        logger.debug(f"  dernière:   {datetime_rows[-1]}")
        return _datetime_rows_to_minutes(datetime_rows)

    logger.info("Format enregistreur non détecté, fallback colonnes numériques")
    # ── 2. Fallback : format simple deux colonnes numériques ───────────
    temps_list: list[float] = []
    temp_list: list[float] = []
    skipped_lines: list[str] = []

    for line in lines:
        line_clean = line.replace('"', '').strip()
        # Détecter le séparateur
        for sep in ["\t", ";", ",", r"\s{2,}"]:
            if sep == r"\s{2,}":
                parts = re.split(r'\s{2,}', line_clean)
            else:
                parts = line_clean.split(sep)
            if len(parts) >= 2:
                break
        if len(parts) < 2:
            skipped_lines.append(line_clean)
            continue

        t_val = _clean_numeric(parts[0])
        temp_val = _clean_numeric(parts[1])
        if t_val is not None and temp_val is not None:
            temps_list.append(t_val)
            temp_list.append(temp_val)
        else:
            skipped_lines.append(line_clean)

    if len(temps_list) < 2:
        hint = ""
        if skipped_lines:
            hint = f"\nLignes ignorées (non numériques) : {skipped_lines[:3]}"
        raise ValueError(
            f"Pas assez de données numériques (seulement {len(temps_list)} point(s) trouvé(s)).\n"
            f"Format attendu : deux colonnes séparées par tabulation, point-virgule ou virgule :\n"
            f"  Temps (min)    Température (°C)\n"
            f"  0              20\n"
            f"  1              45{hint}"
        )

    return temps_list, temp_list


# ── Mois français → numéro ────────────────────────────────────────────────
_FRENCH_MONTHS = {
    "janv": 1, "jan": 1, "janvier": 1,
    "fév": 2, "fev": 2, "fevr": 2, "février": 2, "fevrier": 2,
    "mars": 3, "mar": 3,
    "avr": 4, "avril": 4,
    "mai": 5,
    "juin": 6, "jun": 6,
    "juil": 7, "juill": 7, "juillet": 7, "jul": 7,
    "août": 8, "aout": 8, "aoû": 8, "aou": 8,
    "sept": 9, "sep": 9, "septembre": 9,
    "oct": 10, "octobre": 10,
    "nov": 11, "novembre": 11,
    "déc": 12, "dec": 12, "décembre": 12, "decembre": 12,
}


def _parse_french_datetime(s: str):
    """Parse une date/heure française type '25/sept/2025 15:06:01' ou '25/09/2025 15:06:01'."""
    from datetime import datetime as dt
    import re

    s = s.strip().strip('"')

    # Formats courants des enregistreurs
    # "25/sept/2025 15:06:01"  ou  "25/09/2025 15:06:01"  ou  "2025-09-25 15:06:01"
    # "9/24/25 11:01" (US short M/D/YY)
    # Essai format numérique standard
    for fmt in ("%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M",
                "%Y-%m-%dT%H:%M:%S", "%d-%m-%Y %H:%M:%S",
                "%m/%d/%y %H:%M", "%m/%d/%y %H:%M:%S",
                "%m/%d/%Y %H:%M", "%m/%d/%Y %H:%M:%S",
                "%Y/%m/%d %H:%M", "%Y/%m/%d %H:%M:%S"):
        try:
            return dt.strptime(s, fmt)
        except ValueError:
            pass

    # Format avec mois français : "25/sept/2025 15:06:01"
    m = re.match(
        r"(\d{1,2})[/\-.]([a-zéûôàèùëïüâêîôû]+)[/\-.](\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?)",
        s, re.IGNORECASE,
    )
    if m:
        day, month_str, year, time_str = m.groups()
        month_num = _FRENCH_MONTHS.get(month_str.lower().rstrip("."))
        if month_num is None:
            raise ValueError(f"Mois inconnu : {month_str}")
        time_parts = time_str.split(":")
        hour, minute = int(time_parts[0]), int(time_parts[1])
        sec = int(time_parts[2]) if len(time_parts) > 2 else 0
        year_int = int(year)
        if year_int < 100:
            year_int += 2000
        return dt(year_int, month_num, int(day), hour, minute, sec)

    raise ValueError(f"Format de date non reconnu : {s}")


def _try_parse_logger_format(lines: list[str]):
    """Tente de parser un export enregistreur (type DS1922E).

    Recherche une ligne d'en-tête contenant 'Date' et 'Temp', puis lit
    toutes les lignes suivantes comme datetime, température.
    Retourne une liste de tuples (datetime, float) ou None.
    """
    import csv as _csv

    header_idx = None
    date_col = None
    temp_col = None

    # Detect separator used in the data
    _sep = ','
    for line in lines[:5]:
        if '\t' in line:
            _sep = '\t'
            break
        elif ';' in line:
            _sep = ';'
            break

    for i, line in enumerate(lines):
        low = line.lower().replace('"', '').strip()
        # Chercher une ligne qui contient à la fois date/heure ET température
        if ("date" in low or "heure" in low) and ("temp" in low or "°c" in low):
            # Parser cette ligne comme en-tête
            if _sep == '\t':
                headers = [h.strip() for h in line.split('\t')]
            else:
                reader = _csv.reader([line], delimiter=_sep)
                headers = next(reader)
            for j, h in enumerate(headers):
                h_low = h.lower().strip()
                if "date" in h_low or "heure" in h_low:
                    date_col = j
                if "temp" in h_low or "°c" in h_low:
                    temp_col = j
            if date_col is not None and temp_col is not None:
                header_idx = i
                break

    if header_idx is None:
        return None

    rows = []
    for line in lines[header_idx + 1:]:
        if not line.strip() or line.strip() == '""':
            continue
        if _sep == '\t':
            parts = [p.strip() for p in line.split('\t')]
        else:
            reader = _csv.reader([line], delimiter=_sep)
            try:
                parts = next(reader)
            except StopIteration:
                continue
        if len(parts) <= max(date_col, temp_col):
            continue
        try:
            datetime_val = _parse_french_datetime(parts[date_col])
            temp_val = float(parts[temp_col].replace(",", ".").strip().strip('"'))
            rows.append((datetime_val, temp_val))
        except (ValueError, IndexError):
            continue

    return rows if len(rows) >= 2 else None


def _datetime_rows_to_minutes(rows):
    """Convertit une liste [(datetime, temp), ...] en listes temps_minutes, températures."""
    t0 = rows[0][0]
    temps_list = []
    temp_list = []
    for dt_val, temp_val in rows:
        delta = (dt_val - t0).total_seconds() / 60.0
        temps_list.append(round(delta, 4))
        temp_list.append(temp_val)
    return temps_list, temp_list


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
