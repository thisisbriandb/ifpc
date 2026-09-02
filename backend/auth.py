from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import base64
import os
import time
import uuid
from typing import Optional

# La même clé secrète que dans Spring Boot JwtService : Spring utilise
# Decoders.BASE64.decode() pour obtenir les bytes de la clé. JWT_SECRET doit
# porter la même valeur ici et sur le service Spring Boot, sinon la
# vérification des jetons échoue (403 sur les fonctions EXPERT / ADMIN).
#
# Aucune valeur de repli : une clé écrite dans le dépôt est une clé publique,
# avec laquelle n'importe qui peut forger un jeton d'administrateur.
_SECRET_KEY_B64 = os.environ.get("JWT_SECRET")
if not _SECRET_KEY_B64:
    raise RuntimeError(
        "JWT_SECRET n'est pas défini. Générer une clé propre à cet environnement "
        "(openssl rand -base64 48) et la partager avec le Core API Spring Boot."
    )
SECRET_KEY = base64.b64decode(_SECRET_KEY_B64)
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None

def verify_advanced_access(user: Optional[dict], t_ref, z, microorganisme):
    if t_ref is not None or z is not None or microorganisme is not None:
        role = user.get("role", "ROLE_USER") if user else "ROLE_ANONYMOUS"
        if role not in ["ROLE_EXPERT", "ROLE_ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous devez être connecté avec un compte Expert ou Admin pour utiliser les paramètres avancés (t_ref, z, microorganisme).",
            )


# Durée pendant laquelle un résultat reste enregistrable. Assez large pour
# qu'un opérateur relise sa courbe avant d'enregistrer, assez courte pour
# qu'un jeton égaré ne serve plus.
VALIDITE_JETON_RESULTAT_S = 3600


def signer_resultat(type_resultat: str, champs: dict, duree_validite_s: int = VALIDITE_JETON_RESULTAT_S) -> str:
    """Scelle un résultat de calcul, pour que seul le moteur puisse en produire un.

    L'enregistrement d'une analyse vaut pièce de maîtrise sanitaire : son
    verdict ne doit pas pouvoir être écrit par le poste client. Le moteur signe
    donc ce qu'il a calculé avec le secret déjà partagé avec le Core API, lequel
    refuse d'enregistrer un résultat dont la signature ne tient pas.

    Le « jti » est à usage unique côté Core API : un même résultat ne peut pas
    être rejoué sur plusieurs numéros de lot.
    """
    maintenant = int(time.time())
    payload = {
        "typ_resultat": type_resultat,
        **champs,
        "jti": uuid.uuid4().hex,
        "iat": maintenant,
        "exp": maintenant + duree_validite_s,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verifier_jeton_resultat(jeton: str) -> dict:
    """Relit un jeton de résultat. Lève jwt.PyJWTError s'il ne tient pas.

    Présent surtout pour les tests et pour un éventuel outil de vérification
    hors ligne : en exploitation, c'est le Core API Spring Boot qui contrôle.
    """
    return jwt.decode(jeton, SECRET_KEY, algorithms=[ALGORITHM])
