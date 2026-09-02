-- =============================================================================
-- PADOC — Schéma relationnel
-- Base : PostgreSQL 15+
-- =============================================================================
--
-- CE FICHIER EST DESCRIPTIF, PAS EXÉCUTÉ.
--
-- Le schéma réel est produit par Hibernate (`spring.jpa.hibernate.ddl-auto:
-- update`) à partir des entités JPA de `com.ifpc.api.models`. Ce fichier en
-- donne la lecture SQL, pour qui doit comprendre ou auditer la base sans lire
-- le code Java.
--
-- Sa conformité aux entités est vérifiée par `SchemaDocumenteTest` : toute
-- table ou colonne ajoutée à une entité sans être reportée ici fait échouer
-- l'intégration continue. Le fichier avait dérivé d'une version entière du
-- modèle — il décrivait la base d'avant le cloisonnement multi-locataire.
--
-- Limite connue : `ddl-auto: update` n'enlève jamais rien et ne renomme rien.
-- Une colonne retirée d'une entité subsiste en base sans que rien ne le
-- signale. Passer à un outil de migration versionnée reste à décider.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE : users (comptes et droits)
-- ---------------------------------------------------------------------------
-- Le rôle PENDING est l'état d'un compte créé mais pas encore approuvé par un
-- administrateur ; il ne donne accès à rien.

CREATE TABLE users (
    id                          BIGSERIAL       PRIMARY KEY,
    first_name                  VARCHAR(255),
    last_name                   VARCHAR(255),
    company_name                VARCHAR(255),
    company_role                VARCHAR(255),
    email                       VARCHAR(255)    NOT NULL UNIQUE,
    password                    VARCHAR(255)    NOT NULL,
    role                        VARCHAR(255)    NOT NULL,   -- PENDING, USER, EXPERT, ADMIN
    enabled                     BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login                  TIMESTAMP,
    reset_password_token        VARCHAR(255),
    reset_password_token_expiry TIMESTAMP
);


-- ---------------------------------------------------------------------------
-- TABLE : cuves (équipement physique)
-- ---------------------------------------------------------------------------
-- owner_email porte le cloisonnement multi-locataire : la clé de locataire est
-- l'adresse de l'utilisateur (cf. com.ifpc.api.security.Tenant).

CREATE TABLE cuves (
    id              BIGSERIAL        PRIMARY KEY,
    nom             VARCHAR(255)     NOT NULL,
    owner_email     VARCHAR(255),
    volume_max      DOUBLE PRECISION NOT NULL,
    statut_physique VARCHAR(255)     NOT NULL DEFAULT 'PROPRE',  -- PROPRE, SALE, EN_NETTOYAGE, EN_MAINTENANCE
    plan_x          DOUBLE PRECISION,
    plan_y          DOUBLE PRECISION,
    deleted         BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP        NOT NULL,
    updated_at      TIMESTAMP        NOT NULL
);


-- ---------------------------------------------------------------------------
-- TABLE : lots (produit fluide / contenu)
-- ---------------------------------------------------------------------------
-- L'identifiant n'est pas unique globalement : deux exploitations peuvent
-- nommer un lot de la même façon. L'unicité attendue porte sur le couple
-- (owner_email, identifiant) — elle est décrite dans le modèle Lot mais n'est
-- déclarée par aucune contrainte, ni ici ni dans l'entité. À trancher.

CREATE TABLE lots (
    id              BIGSERIAL        PRIMARY KEY,
    identifiant     VARCHAR(100)     NOT NULL,
    owner_email     VARCHAR(255),
    type_produit    VARCHAR(100)     NOT NULL,
    volume_actuel   DOUBLE PRECISION NOT NULL DEFAULT 0,
    color_l         DOUBLE PRECISION,
    color_a         DOUBLE PRECISION,
    color_b         DOUBLE PRECISION,
    color_hex       VARCHAR(255),
    spectrum_json   TEXT,
    statut_lot      VARCHAR(30)      NOT NULL DEFAULT 'EN_FERMENTATION',  -- EN_FERMENTATION, PRET_A_ASSEMBLER, EMBOUTEILLE
    deleted         BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP        NOT NULL,
    updated_at      TIMESTAMP        NOT NULL
);


-- ---------------------------------------------------------------------------
-- TABLE : stockages (relation cuve ↔ lot — où est le lot actuellement ?)
-- ---------------------------------------------------------------------------
-- date_fin NULL = stockage en cours.

CREATE TABLE stockages (
    id              BIGSERIAL        PRIMARY KEY,
    cuve_id         BIGINT           NOT NULL REFERENCES cuves(id),
    lot_id          BIGINT           NOT NULL REFERENCES lots(id),
    volume_occupe   DOUBLE PRECISION NOT NULL,
    date_debut      TIMESTAMP        NOT NULL,
    date_fin        TIMESTAMP
);


-- ---------------------------------------------------------------------------
-- TABLE : operations (journal des mouvements de chai)
-- ---------------------------------------------------------------------------

CREATE TABLE operations (
    id              BIGSERIAL        PRIMARY KEY,
    type            VARCHAR(30)      NOT NULL,  -- NETTOYAGE, REMPLISSAGE, TRANSFERT, TRANSFORMATION, ASSEMBLAGE
    cuve_source_id  BIGINT           REFERENCES cuves(id),
    cuve_dest_id    BIGINT           REFERENCES cuves(id),
    lot_id          BIGINT           REFERENCES lots(id),
    lot_resultat_id BIGINT           REFERENCES lots(id),
    volume          DOUBLE PRECISION,
    description     TEXT,
    user_email      VARCHAR(255),
    created_at      TIMESTAMP        NOT NULL
);


-- ---------------------------------------------------------------------------
-- TABLE : analysis_history (registre des analyses)
-- ---------------------------------------------------------------------------
-- Pièce de maîtrise sanitaire. Deux mécanismes la protègent :
--
--   scelle / jeton_resultat / resultat_jti
--     Un contrôle de pasteurisation n'est archivé que sur présentation d'un
--     jeton signé par le moteur de calcul. Le verdict, la VP, la cible et les
--     paramètres viennent de ce jeton, jamais du corps de la requête. Le jeton
--     est conservé pour rester vérifiable hors de l'application, et son
--     identifiant est unique : un même résultat ne peut pas être rejoué sur
--     plusieurs lots.
--
--   deleted / deleted_at / deleted_by
--     La suppression est logique. Une analyse retirée de l'historique reste au
--     registre, et l'opération est consignée au journal d'audit.

CREATE TABLE analysis_history (
    id              BIGSERIAL        PRIMARY KEY,
    type            VARCHAR(255)     NOT NULL,  -- controle, bareme, assemblage
    label           VARCHAR(255)     NOT NULL,
    lot_identifier  VARCHAR(255),
    statut          VARCHAR(255),
    vp              DOUBLE PRECISION,
    vp_cible        DOUBLE PRECISION,
    parametres      TEXT,
    courbe          TEXT,
    result_json     TEXT,
    user_email      VARCHAR(255),
    jeton_resultat  TEXT,
    resultat_jti    VARCHAR(64)      UNIQUE,
    scelle          BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted         BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      VARCHAR(255),
    created_at      TIMESTAMP        NOT NULL
);


-- ---------------------------------------------------------------------------
-- TABLE : audit_log (journal des opérations sensibles)
-- ---------------------------------------------------------------------------
-- En AJOUT SEUL : aucun point d'entrée de l'application ne modifie ni
-- n'efface une entrée. Consigne la suppression d'une analyse, un changement
-- de rôle, une modification de VP cible, une suppression de compte.
--
-- created_at est en TIMESTAMP WITH TIME ZONE, contrairement au reste du
-- modèle : une entrée de journal doit être datée sans ambiguïté.

CREATE TABLE audit_log (
    id              BIGSERIAL        PRIMARY KEY,
    action          VARCHAR(40)      NOT NULL,  -- ANALYSE_SUPPRIMEE, VP_CIBLE_MODIFIEE, ROLE_MODIFIE, COMPTE_APPROUVE, COMPTE_SUPPRIME
    cible_type      VARCHAR(40)      NOT NULL,  -- analyse, utilisateur, configuration produit
    cible_id        VARCHAR(255),
    acteur_email    VARCHAR(255),
    details         TEXT,
    created_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_audit_log_acteur ON audit_log(acteur_email);


-- ---------------------------------------------------------------------------
-- TABLE : product_config (VP cible par produit, réglable en administration)
-- ---------------------------------------------------------------------------
-- Attention : cette valeur pilote l'indicateur de risque et l'affichage, mais
-- pas le verdict de conformité, qui repose sur k >= 15 (cf.
-- referentiel-scientifique.md §3.1). Les deux règles coexistent — à unifier.

CREATE TABLE product_config (
    id              BIGSERIAL        PRIMARY KEY,
    product_type    VARCHAR(255)     NOT NULL UNIQUE,
    product_name    VARCHAR(255)     NOT NULL,
    vp_cible        DOUBLE PRECISION NOT NULL,
    updated_at      TIMESTAMP
);


-- ---------------------------------------------------------------------------
-- TABLE : help_text (contenus d'aide, modifiables en administration)
-- ---------------------------------------------------------------------------
-- La clé porte le suffixe de langue : « aide_bareme__fr », « aide_bareme__en ».

CREATE TABLE help_text (
    id              BIGSERIAL        PRIMARY KEY,
    text_key        VARCHAR(255)     NOT NULL UNIQUE,
    content         TEXT             NOT NULL,
    updated_at      TIMESTAMP
);
