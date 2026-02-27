# IFPC Pasteurization API

API FastAPI pour l'évaluation de la pasteurisation.

## Installation

```bash
pip install -r requirements.txt
```

## Démarrage

```bash
# Méthode 1: Directement avec Python
python main.py

# Méthode 2: Avec uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Documentation

Une fois l'API démarrée, accédez à:
- Documentation interactive: http://localhost:8000/docs
- Documentation alternative: http://localhost:8000/redoc

## Endpoints

### POST /api/pasteurization/evaluate
Évalue un processus de pasteurisation.

**Body:**
```json
{
  "temperature": 72.0,
  "duration": 15.0,
  "product_type": "lait"
}
```

**Response:**
```json
{
  "is_valid": true,
  "message": "Pasteurisation conforme. Valeur P: 15.00s (minimum requis: 15.00s)",
  "valeur_pasteurisation": 15.0
}
```

### GET /health
Vérifie l'état de l'API.
