-- =============================================================================
-- PADOC — Schéma relationnel "Chai Virtuel"
-- Base : PostgreSQL 15+
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------

CREATE TYPE statut_physique AS ENUM (
    'PROPRE',
    'SALE',
    'EN_NETTOYAGE',
    'EN_MAINTENANCE'
);

CREATE TYPE statut_lot AS ENUM (
    'EN_FERMENTATION',
    'PRET_A_ASSEMBLER',
    'EMBOUTEILLE'
);

CREATE TYPE type_operation AS ENUM (
    'NETTOYAGE',
    'REMPLISSAGE',
    'TRANSFERT',
    'TRANSFORMATION',
    'ASSEMBLAGE'
);

-- ---------------------------------------------------------------------------
-- TABLE : cuves (Équipement physique)
-- ---------------------------------------------------------------------------

CREATE TABLE cuves (
    id              BIGSERIAL       PRIMARY KEY,
    nom             VARCHAR(255)    NOT NULL,
    volume_max      DOUBLE PRECISION NOT NULL CHECK (volume_max > 0),
    statut_physique VARCHAR(30)     NOT NULL DEFAULT 'PROPRE',
    deleted         BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cuves_deleted ON cuves(deleted);
CREATE INDEX idx_cuves_statut ON cuves(statut_physique);

-- ---------------------------------------------------------------------------
-- TABLE : lots (Produit fluide / contenu)
-- ---------------------------------------------------------------------------

CREATE TABLE lots (
    id              BIGSERIAL       PRIMARY KEY,
    identifiant     VARCHAR(100)    NOT NULL UNIQUE,
    type_produit    VARCHAR(100)    NOT NULL,
    volume_actuel   DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (volume_actuel >= 0),
    color_l         DOUBLE PRECISION,
    color_a         DOUBLE PRECISION,
    color_b         DOUBLE PRECISION,
    color_hex       VARCHAR(7),
    spectrum_json   TEXT,
    statut_lot      VARCHAR(30)     NOT NULL DEFAULT 'EN_FERMENTATION',
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lots_statut ON lots(statut_lot);
CREATE INDEX idx_lots_type ON lots(type_produit);

-- ---------------------------------------------------------------------------
-- TABLE : stockages (Relation Cuve ↔ Lot — où est le lot actuellement ?)
-- ---------------------------------------------------------------------------

CREATE TABLE stockages (
    id              BIGSERIAL       PRIMARY KEY,
    cuve_id         BIGINT          NOT NULL REFERENCES cuves(id),
    lot_id          BIGINT          NOT NULL REFERENCES lots(id),
    volume_occupe   DOUBLE PRECISION NOT NULL CHECK (volume_occupe > 0),
    date_debut      TIMESTAMP       NOT NULL DEFAULT NOW(),
    date_fin        TIMESTAMP,

    CONSTRAINT uq_stockage_actif UNIQUE (cuve_id, lot_id, date_fin)
);

CREATE INDEX idx_stockages_cuve_actif ON stockages(cuve_id) WHERE date_fin IS NULL;
CREATE INDEX idx_stockages_lot ON stockages(lot_id);

-- ---------------------------------------------------------------------------
-- TABLE : operations (Traçabilité de chaque action)
-- ---------------------------------------------------------------------------

CREATE TABLE operations (
    id              BIGSERIAL       PRIMARY KEY,
    type            VARCHAR(30)     NOT NULL,
    cuve_source_id  BIGINT          REFERENCES cuves(id),
    cuve_dest_id    BIGINT          REFERENCES cuves(id),
    lot_id          BIGINT          REFERENCES lots(id),
    lot_resultat_id BIGINT          REFERENCES lots(id),
    volume          DOUBLE PRECISION,
    description     TEXT,
    user_email      VARCHAR(255),
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operations_type ON operations(type);
CREATE INDEX idx_operations_lot ON operations(lot_id);
CREATE INDEX idx_operations_cuve_src ON operations(cuve_source_id);
CREATE INDEX idx_operations_cuve_dst ON operations(cuve_dest_id);
CREATE INDEX idx_operations_date ON operations(created_at DESC);

-- ---------------------------------------------------------------------------
-- MIGRATION : Données existantes (cuves actuelles → nouveau modèle)
-- ---------------------------------------------------------------------------
-- À exécuter une seule fois lors de la migration :
--
-- 1. Renommer les colonnes de la table cuves existante
-- 2. Créer des lots à partir des données produit des cuves
-- 3. Créer des stockages reliant cuves et lots
--
-- INSERT INTO lots (identifiant, type_produit, volume_actuel, color_l, color_a, color_b, color_hex, spectrum_json, statut_lot)
-- SELECT
--     COALESCE(lot_identifier, 'LOT-MIGRE-' || id),
--     COALESCE(type_produit, 'Non défini'),
--     volume_actuel,
--     color_l, color_a, color_b, color_hex, spectrum_json,
--     'PRET_A_ASSEMBLER'
-- FROM cuves_old
-- WHERE volume_actuel > 0;
--
-- INSERT INTO stockages (cuve_id, lot_id, volume_occupe)
-- SELECT c.id, l.id, l.volume_actuel
-- FROM cuves c
-- JOIN lots l ON l.identifiant = COALESCE(c_old.lot_identifier, 'LOT-MIGRE-' || c_old.id)
-- ...
