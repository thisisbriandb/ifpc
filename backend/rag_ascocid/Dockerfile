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
# `serve` sert le trafic ; `ingest` peuple le volume depuis le conteneur, et
# `ask` permet de vérifier la recherche sans passer par le HTTP. Les deux
# derniers ne coûtent rien : leurs dépendances sont déjà installées.
COPY serve demarrer amorcer ingest ask probe ./

# Le corpus, l'index et le cache des poids vivent sous /data. Pas de directive
# VOLUME : Railway la refuse (« use Railway Volumes ») et monte le sien sur ce
# chemin. Le répertoire est créé quand même — sans volume monté, le service
# démarre en mode dégradé et le dit sur /api/ldc/sante, plutôt que de refuser
# de se lancer.
RUN mkdir -p /data
ENV ASCOCID_SQLITE=/data/ascocid.sqlite \
    ASCOCID_DATA=/data \
    LDC_HOST=::

EXPOSE 8100
CMD ["./demarrer"]
