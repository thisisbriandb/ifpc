from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import io
import csv
import logging
import pandas as pd
import pasto
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
    microorganisme: Optional[str] = None
    clarification: str = "trouble"
    procede: str = "classique"


class PasteDataRequest(BaseModel):
    raw_text: str
    product_type: str = "jus_pomme"
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
async def get_produits():
    return pasto.get_produits()


@app.get("/api/referentiels/microorganismes")
async def get_microorganismes():
    return pasto.get_microorganismes()


@app.get("/api/referentiels/procedes")
async def get_procedes():
    return pasto.get_procedes()


@app.get("/api/referentiels/clarifications")
async def get_clarifications():
    return pasto.CLARIFICATIONS


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
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith(".csv"):
            text = content.decode("utf-8", errors="replace")
            # Détection automatique du séparateur
            sep = ";" if ";" in text.split("\n")[0] else ","
            df = pd.read_csv(io.StringIO(text), sep=sep)
        else:
            raise HTTPException(
                status_code=400,
                detail="Format non supporté. Utilisez .xlsx, .xls ou .csv",
            )

        temps_col, temp_col = _detect_columns(df)

        temps_list = df[temps_col].astype(float).tolist()
        temp_list = df[temp_col].astype(float).tolist()

        result = pasto.evaluer_pasteurisation(
            temperatures=temp_list,
            temps=temps_list,
            product_type=product_type,
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
            microorganisme=request.microorganisme,
            clarification=request.clarification,
            procede=request.procede,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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

def _detect_columns(df: pd.DataFrame):
    """Détecte automatiquement les colonnes temps et température."""
    cols_lower = {c: c.lower().strip() for c in df.columns}

    temps_col = None
    temp_col = None

    for orig, low in cols_lower.items():
        if any(k in low for k in ["temps", "time", "minute", "min", "sec", "durée", "duree"]):
            temps_col = orig
        if any(k in low for k in ["temp", "°c", "degre", "degree", "celsius"]):
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


def _parse_pasted_text(raw_text: str):
    """Parse du texte collé en listes temps (minutes) / température (°C).

    Gère :
    - Format simple : deux colonnes numériques (temps, température)
    - Format enregistreur (DS1922E, etc.) : en-têtes métadonnées, colonnes
      "Date / Heure" + "Température (°C)", dates françaises, champs CSV entre
      guillemets.
    """
    lines = [l.strip() for l in raw_text.strip().split("\n") if l.strip()]
    if len(lines) < 2:
        raise ValueError("Il faut au moins 2 lignes de données")

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

    for line in lines:
        # Retirer les guillemets éventuels
        line = line.replace('"', '')
        # Essayer tab, puis ;, puis ,
        for sep in ["\t", ";", ","]:
            parts = line.split(sep)
            if len(parts) >= 2:
                break
        if len(parts) < 2:
            continue
        try:
            t = float(parts[0].replace(",", ".").strip())
            temp = float(parts[1].replace(",", ".").strip())
            temps_list.append(t)
            temp_list.append(temp)
        except ValueError:
            continue

    if len(temps_list) < 2:
        raise ValueError(
            "Pas assez de données numériques. "
            "Format attendu : temps<tab>température  ou  export enregistreur CSV."
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
    # Essai format numérique standard
    for fmt in ("%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M",
                "%Y-%m-%dT%H:%M:%S", "%d-%m-%Y %H:%M:%S"):
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

    for i, line in enumerate(lines):
        low = line.lower().replace('"', '').strip()
        # Chercher une ligne qui contient à la fois date/heure ET température
        if ("date" in low or "heure" in low) and ("temp" in low or "°c" in low):
            # Parser cette ligne comme en-tête CSV
            reader = _csv.reader([line])
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
        reader = _csv.reader([line])
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
