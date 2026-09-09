# Image du service de réponse AsCoCid (spec 07).
#
# Deux partis pris dictés par la cible (Railway) :
#
#   * torch en version CPU explicite. La roue par défaut de PyPI embarque les
#     bibliothèques CUDA — 2,5 Go pour rien sur une machine sans GPU.
#   * les poids du modèle d'embeddings ne sont PAS dans l'image. Ils sont
#     téléchargés au premier démarrage dans le cache Hugging Face, placé sur le
#     volume : une image légère, et un seul téléchargement pour la vie du
#     volume. Sans ce réglage, chaque redéploiement retéléchargerait 1,1 Go.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Cache des poids sur le volume monté (cf. ASCOCID_DATA plus bas).
    HF_HOME=/data/modeles \
    # Le service ne s'entraîne pas : pas de télémétrie ni de parallélisme de
    # tokenizer, qui bavarde sur chaque requête.
    TOKENIZERS_PARALLELISM=false

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir "torch>=2.4,<3" \
      --index-url https://download.pytorch.org/whl/cpu

COPY pyproject.toml ./
COPY src/ ./src/
RUN pip install --no-cache-dir ".[service]"

COPY config/ ./config/
COPY serve ./serve

# Le corpus et l'index sont montés ici (volume). Le répertoire existe même
# vide : le service démarre en mode dégradé et le dit sur /api/ldc/sante
# plutôt que de refuser de se lancer.
VOLUME ["/data"]
ENV ASCOCID_SQLITE=/data/ascocid.sqlite \
    ASCOCID_DATA=/data \
    LDC_HOST=::

EXPOSE 8100
CMD ["./serve"]
