# IFPC — Portail de Décision Cidricole

Plateforme d'aide à la décision pour la filière cidricole française. L'outil accompagne les producteurs et techniciens dans la pasteurisation et l'analyse colorimétrique des productions (jus, cidres).

---

##  Résumé

IFPC centralise les calculs techniques critiques pour la production cidricole : calcul de la Valeur Pasteur (VP), aide au barème de pasteurisation, et mesures colorimétriques. Le portail vise à standardiser les pratiques et sécuriser la qualité des productions à l'échelle de la filière.

---

##  Fonctionnalités en cours

### Pasteurisation
Module de calcul de la Valeur Pasteur cumulée (VP) à partir de relevés de température. L'outil détermine si un lot a atteint la pasteurisation cible en fonction du produit (jus, cidre), de sa clarification (trouble/limpide), et du micro-organisme cible. Intègre un aide-barème pour estimer les temps de maintien nécessaires selon la température de consigne.

### Colorimétrie *(en développement)*
Module de mesure et d'analyse des caractéristiques colorimétriques des productions. Permet la mesure objective des références colorées et l'analyse comparative des lots pour le suivi qualité et le contrôle de production.

---

## Déploiement local

### Prérequis
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+

### Installation

```bash
# 1. Cloner le repository
git clone https://github.com/thisisbriandb/ifpc.git
cd ifpc

# 2. Backend
python -m venv backend/venv
source backend/venv/bin/activate  # Windows: backend\venv\Scripts\activate
pip install -r backend/requirements.txt

# 3. Configuration
cp backend/.env.example backend/.env
# Éditer backend/.env avec vos credentials DB

# 4. Base de données
alembic upgrade head

# 5. Frontend
cd frontend
npm install

# 6. Lancement
cd ../backend
uvicorn app.main:app --reload --port 8000 &
cd ../frontend
npm run dev
```

Accès : http://localhost:3000

---

## Déploiement Vercel

### Backend (API)

```bash
cd backend
```

1. Créer un projet sur [Vercel](https://vercel.com)
2. Configurer les variables d'environnement dans l'interface Vercel :
   - `DATABASE_URL` (PostgreSQL)
   - `SECRET_KEY`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`
3. Déployer :
   ```bash
   vercel --prod
   ```

### Frontend

```bash
cd frontend
```

1. Créer un projet Next.js sur Vercel
2. Configurer la variable d'environnement :
   - `NEXT_PUBLIC_API_URL` (URL du backend déployé)
3. Déployer :
   ```bash
   vercel --prod
   ```

### Configuration proxy
Dans `frontend/next.config.js`, s'assurer que le rewrites pointe vers l'URL backend :

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`
    }
  ]
}
```

---

## Architecture

- **Frontend** : Next.js 14 + React + TypeScript + Tailwind CSS
- **Backend** : FastAPI + SQLAlchemy + Pydantic
- **Base de données** : PostgreSQL
- **Authentification** : JWT

---

## Licence

Propriétaire — Institut Français des Productions Cidricoles (IFPC)
# IFPC — Portail de Décision Cidricole

Plateforme d’aide à la décision destinée à la filière cidricole française. Cet outil accompagne les producteurs et techniciens dans la maîtrise des procédés de pasteurisation et l’analyse colorimétrique des productions (jus, cidres).

---

## Objectif

Fournir un cadre fiable et reproductible pour :

* la validation des procédés de pasteurisation
* la réduction des risques microbiologiques
* la standardisation des pratiques au sein de la filière
* le suivi qualité des productions

---

## Présentation

Le portail IFPC centralise les calculs techniques critiques liés à la transformation cidricole. Il permet d’analyser des relevés de production, de vérifier l’atteinte des objectifs de traitement thermique, et d’assurer une cohérence des pratiques entre acteurs.

---

## Fonctionnalités

### Pasteurisation

Module de calcul de la Valeur Pasteur cumulée (VP) à partir de relevés de température.

Fonctionnalités principales :

* Calcul de la VP en continu
* Évaluation de la conformité d’un lot selon :

  * le type de produit (jus, cidre)
  * l’état (trouble ou limpide)
  * le micro-organisme cible
* Aide à la définition des barèmes de pasteurisation
* Estimation des temps de maintien en fonction des températures de consigne

---

### Colorimétrie (en développement)

Module d’analyse des caractéristiques colorimétriques des productions.

Objectifs :

* Mesure objective des références colorées
* Comparaison inter-lots
* Suivi qualité en production
* Détection de dérives

---

## Cas d’usage

* Validation de procédés de pasteurisation en production
* Analyse de conformité d’un lot
* Définition ou ajustement de barèmes thermiques
* Suivi qualité et homogénéité des productions
* Comparaison analytique entre lots

---

## Déploiement local

### Prérequis

* Node.js 18 ou supérieur
* Python 3.11 ou supérieur
* PostgreSQL 15 ou supérieur

---

### Installation

```bash
# 1. Clonage du dépôt
git clone https://github.com/thisisbriandb/ifpc.git
cd ifpc

# 2. Backend
python -m venv backend/venv
source backend/venv/bin/activate  # Windows : backend\venv\Scripts\activate
pip install -r backend/requirements.txt

# 3. Configuration
cp backend/.env.example backend/.env
# Renseigner les variables d’environnement (base de données, sécurité)

# 4. Base de données
alembic upgrade head

# 5. Frontend
cd frontend
npm install

# 6. Lancement des services
cd ../backend
uvicorn app.main:app --reload --port 8000 &

cd ../frontend
npm run dev
```

Accès local : `http://localhost:3000`

---

## Déploiement

### Backend (API)

```bash
cd backend
```

Étapes :

1. Créer un projet sur la plateforme de déploiement
2. Configurer les variables d’environnement :

   * `DATABASE_URL`
   * `SECRET_KEY`
   * `ACCESS_TOKEN_EXPIRE_MINUTES`
3. Lancer le déploiement

---

### Frontend

```bash
cd frontend
```

Étapes :

1. Créer un projet frontend
2. Configurer :

   * `NEXT_PUBLIC_API_URL`
3. Déployer l’application

---

### Configuration du proxy

Dans `frontend/next.config.js` :

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`
    }
  ]
}
```

---

## Architecture technique

* Frontend : Next.js, TypeScript, Tailwind CSS
* Backend : FastAPI, Spring Boot
* Base de données : PostgreSQL
* Authentification : JWT

---

## Licence

Propriétaire — Institut Français des Productions Cidricoles (IFPC)
