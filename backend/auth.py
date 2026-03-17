from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Optional

# La même clé secrète que dans Spring Boot JwtService
SECRET_KEY = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970"
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
