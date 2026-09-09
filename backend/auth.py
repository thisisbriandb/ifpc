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

def verify_advanced_access(user: Optional[dict], t_ref, z, microorganisme, product_type=None):
    """Réserve aux comptes Expert et Admin les paramètres qui s'écartent du référentiel.

    Désigner le microorganisme de référence de son propre produit, ou en
    reprendre le Tref et le z, n'est pas un acte d'expert : c'est ce que
    l'application applique déjà par défaut. Seule une valeur qui s'en écarte
    demande le rôle.

    Sans cette distinction, sélectionner un cidre suffisait à se voir refuser
    l'analyse : le sélecteur de produit renseignait les trois champs avec les
    valeurs de référence, et le garde-fou les prenait pour une surcharge.
    """
    if not _s_ecarte_du_referentiel(t_ref, z, microorganisme, product_type):
        return

    role = user.get("role", "ROLE_USER") if user else "ROLE_ANONYMOUS"
    if role not in ["ROLE_EXPERT", "ROLE_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous devez être connecté avec un compte Expert ou Admin pour utiliser les paramètres avancés (t_ref, z, microorganisme).",
        )


def _s_ecarte_du_referentiel(t_ref, z, microorganisme, product_type) -> bool:
    """Vrai si l'un des paramètres diffère de ce que le référentiel prévoit."""
    import pasto  # importé ici pour éviter un cycle à l'import du module

    if t_ref is None and z is None and microorganisme is None:
        return False

    produit = pasto.PRODUITS.get(pasto.normaliser_product_type(product_type or ""))
    if produit is None:
        # Produit inconnu : on ne peut rien comparer, le rôle reste exigé.
        return True

    cle_demandee = pasto.normaliser_microorganisme(microorganisme) or produit["microorganisme_defaut"]
    if cle_demandee != produit["microorganisme_defaut"]:
        return True

    reference = pasto.MICROORGANISMES[produit["microorganisme_defaut"]]
    if t_ref is not None and float(t_ref) != float(reference["t_ref"]):
        return True
    if z is not None and float(z) != float(reference["z"]):
        return True
    return False


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
