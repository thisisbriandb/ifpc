"""Configuration commune aux tests du moteur de calcul.

Le module ``auth`` refuse de se charger sans ``JWT_SECRET`` — c'est voulu, une
clé écrite dans le dépôt serait une clé publique. Les tests en fixent donc une
qui ne vaut que pour eux, avant tout import de ``main``.
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

# Base64 de « cle-de-test-sans-valeur-de-production ».
os.environ.setdefault("JWT_SECRET", "Y2xlLWRlLXRlc3Qtc2Fucy12YWxldXItZGUtcHJvZHVjdGlvbg==")
