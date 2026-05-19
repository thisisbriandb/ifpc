# Modèle Conceptuel de Données — Chai Virtuel (PADOC)

## Vue d'ensemble

Le système de gestion de chai sépare clairement :
- **L'équipement physique** (cuves) — qui ne change pas souvent
- **Le produit** (lots) — qui évolue, se transforme, se mélange
- **La relation** (stockage) — qui relie un lot à une cuve à un instant T
- **La traçabilité** (opérations) — qui enregistre chaque action

## Diagramme Entité-Relation

```
┌─────────────────────────────────┐
│            CUVE                  │
│─────────────────────────────────│
│ PK  id                          │
│     nom                         │
│     volume_max (L)              │
│     statut_physique             │
│     deleted / deleted_at        │
│     created_at / updated_at     │
└──────────────┬──────────────────┘
               │
               │ 1
               │
               │ N
┌──────────────▼──────────────────┐
│          STOCKAGE                │
│─────────────────────────────────│
│ PK  id                          │
│ FK  cuve_id                     │
│ FK  lot_id                      │
│     volume_occupe (L)           │
│     date_debut                  │
│     date_fin (NULL = actif)     │
└──────────────▲──────────────────┘
               │ N
               │
               │ 1
┌──────────────┴──────────────────┐
│             LOT                  │
│─────────────────────────────────│
│ PK  id                          │
│     identifiant (ex: LOT-2026-X)│
│     type_produit                │
│     volume_actuel (L)           │
│     color_l / color_a / color_b │
│     color_hex                   │
│     spectrum_json (TEXT)         │
│     statut_lot                  │
│     created_at / updated_at     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│          OPERATION               │
│─────────────────────────────────│
│ PK  id                          │
│     type (ENUM)                 │
│ FK  cuve_source_id (nullable)   │
│ FK  cuve_dest_id (nullable)     │
│ FK  lot_id (nullable)           │
│ FK  lot_resultat_id (nullable)  │
│     volume (L)                  │
│     description                 │
│     user_email                  │
│     created_at                  │
└─────────────────────────────────┘
```

## Statuts

### Cuve — `statut_physique`
| Valeur | Description |
|--------|-------------|
| `PROPRE` | Cuve prête à recevoir un lot |
| `SALE` | Cuve ayant contenu un lot, non encore nettoyée |
| `EN_NETTOYAGE` | Nettoyage en cours |
| `EN_MAINTENANCE` | Hors service (réparation, inspection) |

### Lot — `statut_lot`
| Valeur | Description |
|--------|-------------|
| `EN_FERMENTATION` | Lot en cours de fermentation |
| `PRET_A_ASSEMBLER` | Lot disponible pour assemblage |
| `EMBOUTEILLE` | Lot mis en bouteille (archivé) |

### Opération — `type`
| Type | Description | Impact |
|------|-------------|--------|
| `NETTOYAGE` | Nettoyage d'une cuve | Cuve passe de SALE → PROPRE |
| `REMPLISSAGE` | Affectation d'un lot à une cuve | Crée un stockage |
| `TRANSFERT` | Lot quitte Cuve A → Cuve B | Cuve A → SALE, met à jour stockage |
| `TRANSFORMATION` | Modifie les propriétés d'un lot (filtration, etc.) | Met à jour couleur/spectre du lot |
| `ASSEMBLAGE` | Mélange de lots → nouveau lot | Crée nouveau lot + stockage |

## Règles métier

1. **Une cuve ne peut recevoir un lot que si son statut est `PROPRE`**
2. **Un stockage actif** = `date_fin IS NULL`
3. **Volume occupé** dans une cuve = somme des `volume_occupe` des stockages actifs
4. **Volume disponible** = `volume_max` - volume occupé
5. **Soft-delete** sur les cuves : `deleted = true` + `deleted_at` (jamais supprimées physiquement)
6. **Chaque opération** crée une entrée dans la table `operations` pour la traçabilité complète

## Lien avec le module Colorimétrie

- Le **spectre d'absorption** (`spectrum_json`) est rattaché au **Lot**, pas à la cuve
- Lors d'un **assemblage**, le module colorimétrie calcule les proportions optimales
- Le nouveau lot résultant hérite du spectre calculé par le solveur
