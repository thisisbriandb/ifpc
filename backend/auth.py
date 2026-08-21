from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import base64
import os
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
