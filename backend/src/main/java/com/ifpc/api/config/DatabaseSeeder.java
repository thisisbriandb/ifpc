package com.ifpc.api.config;

import com.ifpc.api.models.ProductConfig;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.ProductConfigRepository;
import com.ifpc.api.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

@Configuration
@RequiredArgsConstructor
public class DatabaseSeeder {

    @Bean
    public CommandLineRunner seedDatabase(
            UserRepository userRepository,
            ProductConfigRepository productConfigRepository,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbcTemplate
    ) {
        return args -> {
            repairCuvesSchema(jdbcTemplate);
            repairLotsSchema(jdbcTemplate);
            repairTenantSchema(jdbcTemplate);

            // Création de l'admin par défaut s'il n'existe pas
            if (userRepository.findByEmail("admin@ifpc.com").isEmpty()) {
                User admin = User.builder()
                        .firstName("Super")
                        .lastName("Admin")
                        .email("admin@ifpc.com")
                        .password(passwordEncoder.encode("admin"))
                        .role(Role.ADMIN)
                        .enabled(true)
                        .build();
                userRepository.save(admin);
                System.out.println("====== COMPTE ADMIN GÉNÉRÉ ======");
                System.out.println("Email: admin@ifpc.com");
                System.out.println("Mot de passe: admin");
                System.out.println("=================================");
            }

            // Seed product configs with default VP cible values (from pasto.py)
            Map<String, Object[]> defaults = Map.of(
                    "jus_pomme",       new Object[]{"Jus de pomme", 15.0},
                    "cidre_doux",      new Object[]{"Cidre doux", 10.0},
                    "cidre_demi_sec",  new Object[]{"Cidre demi-sec", 8.0},
                    "cidre_brut",      new Object[]{"Cidre brut", 5.0},
                    "cidre_extra_brut", new Object[]{"Cidre extra-brut", 5.0},
                    "jus_poire",       new Object[]{"Jus de poire", 15.0}
            );

            for (var entry : defaults.entrySet()) {
                if (productConfigRepository.findByProductType(entry.getKey()).isEmpty()) {
                    ProductConfig config = ProductConfig.builder()
                            .productType(entry.getKey())
                            .productName((String) entry.getValue()[0])
                            .vpCible((Double) entry.getValue()[1])
                            .build();
                    productConfigRepository.save(config);
                    System.out.println("Config produit créée: " + entry.getKey() + " → VP cible = " + entry.getValue()[1]);
                }
            }
        };
    }

    // ── Cloisonnement multi-locataire ────────────────────────────────────────
    // Ajoute la colonne « owner_email » sur les lots et les cuves, rattache les
    // données existantes à leur utilisateur d'origine (déduit du journal des
    // opérations, puis des stockages), et bascule l'unicité de l'identifiant de
    // lot du global vers le périmètre d'un propriétaire.
    private void repairTenantSchema(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("ALTER TABLE lots  ADD COLUMN IF NOT EXISTS owner_email varchar(255)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS owner_email varchar(255)");

        // 1. Lots : l'auteur de la première opération qui les mentionne
        jdbcTemplate.execute("""
                UPDATE lots l SET owner_email = sub.user_email
                FROM (
                    SELECT DISTINCT ON (lot_id) lot_id, user_email
                    FROM operations
                    WHERE lot_id IS NOT NULL AND user_email IS NOT NULL
                    ORDER BY lot_id, created_at
                ) sub
                WHERE l.id = sub.lot_id AND l.owner_email IS NULL
                """);
        jdbcTemplate.execute("""
                UPDATE lots l SET owner_email = sub.user_email
                FROM (
                    SELECT DISTINCT ON (lot_resultat_id) lot_resultat_id, user_email
                    FROM operations
                    WHERE lot_resultat_id IS NOT NULL AND user_email IS NOT NULL
                    ORDER BY lot_resultat_id, created_at
                ) sub
                WHERE l.id = sub.lot_resultat_id AND l.owner_email IS NULL
                """);

        // 2. Cuves : idem, source ou destination
        jdbcTemplate.execute("""
                UPDATE cuves c SET owner_email = sub.user_email
                FROM (
                    SELECT DISTINCT ON (cuve_id) cuve_id, user_email
                    FROM (
                        SELECT cuve_source_id AS cuve_id, user_email, created_at FROM operations
                         WHERE cuve_source_id IS NOT NULL AND user_email IS NOT NULL
                        UNION ALL
                        SELECT cuve_dest_id AS cuve_id, user_email, created_at FROM operations
                         WHERE cuve_dest_id IS NOT NULL AND user_email IS NOT NULL
                    ) x
                    ORDER BY cuve_id, created_at
                ) sub
                WHERE c.id = sub.cuve_id AND c.owner_email IS NULL
                """);

        // 3. Ce que le journal ne couvre pas : propager via les stockages
        jdbcTemplate.execute("""
                UPDATE cuves c SET owner_email = sub.owner_email
                FROM (
                    SELECT DISTINCT ON (s.cuve_id) s.cuve_id, l.owner_email
                    FROM stockages s JOIN lots l ON l.id = s.lot_id
                    WHERE l.owner_email IS NOT NULL
                    ORDER BY s.cuve_id, s.date_debut
                ) sub
                WHERE c.id = sub.cuve_id AND c.owner_email IS NULL
                """);
        jdbcTemplate.execute("""
                UPDATE lots l SET owner_email = sub.owner_email
                FROM (
                    SELECT DISTINCT ON (s.lot_id) s.lot_id, c.owner_email
                    FROM stockages s JOIN cuves c ON c.id = s.cuve_id
                    WHERE c.owner_email IS NOT NULL
                    ORDER BY s.lot_id, s.date_debut
                ) sub
                WHERE l.id = sub.lot_id AND l.owner_email IS NULL
                """);

        // 4. Reliquat non attribuable : rattaché au compte de repli, jamais
        //    laissé sans propriétaire (une ligne orpheline serait invisible).
        String legacyOwner = legacyOwnerEmail();
        jdbcTemplate.update("UPDATE lots  SET owner_email = ? WHERE owner_email IS NULL", legacyOwner);
        jdbcTemplate.update("UPDATE cuves SET owner_email = ? WHERE owner_email IS NULL", legacyOwner);

        // 5. Opérations sans auteur : héritent du propriétaire de leur objet
        jdbcTemplate.execute("""
                UPDATE operations o SET user_email = COALESCE(
                    (SELECT owner_email FROM lots  WHERE id = o.lot_id),
                    (SELECT owner_email FROM lots  WHERE id = o.lot_resultat_id),
                    (SELECT owner_email FROM cuves WHERE id = o.cuve_source_id),
                    (SELECT owner_email FROM cuves WHERE id = o.cuve_dest_id)
                )
                WHERE o.user_email IS NULL
                """);

        // 6. L'identifiant de lot n'est plus unique globalement mais par
        //    propriétaire — et seulement parmi les lots vivants, pour qu'un
        //    identifiant supprimé puisse être réutilisé.
        jdbcTemplate.execute("""
                DO $$
                DECLARE contrainte record;
                BEGIN
                    FOR contrainte IN
                        SELECT con.conname
                        FROM pg_constraint con
                        JOIN pg_class rel ON rel.oid = con.conrelid
                        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
                        WHERE rel.relname = 'lots'
                          AND con.contype = 'u'
                          AND array_length(con.conkey, 1) = 1
                          AND att.attname = 'identifiant'
                    LOOP
                        EXECUTE 'ALTER TABLE lots DROP CONSTRAINT ' || quote_ident(contrainte.conname);
                    END LOOP;
                END $$;
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS ux_lots_owner_identifiant
                ON lots (owner_email, identifiant)
                WHERE deleted = false
                """);
    }

    /** Compte qui hérite des données antérieures au cloisonnement. */
    private String legacyOwnerEmail() {
        String configured = System.getenv("PADOC_LEGACY_OWNER_EMAIL");
        return configured != null && !configured.isBlank() ? configured.trim() : "admin@ifpc.com";
    }

    private void repairCuvesSchema(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS volume_max double precision");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS updated_at timestamp(6)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS created_at timestamp(6)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS deleted boolean");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS deleted_at timestamp(6)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS statut_physique varchar(30)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS plan_x double precision");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS plan_y double precision");

        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'cuves'
                          AND column_name = 'volume_actuel'
                    ) THEN
                        ALTER TABLE cuves ALTER COLUMN volume_actuel SET DEFAULT 0;
                        UPDATE cuves SET volume_actuel = 0 WHERE volume_actuel IS NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("UPDATE cuves SET volume_max = COALESCE(volume_max, 20000) WHERE volume_max IS NULL");
        jdbcTemplate.execute("UPDATE cuves SET updated_at = now() WHERE updated_at IS NULL");
        jdbcTemplate.execute("UPDATE cuves SET created_at = updated_at WHERE created_at IS NULL");
        jdbcTemplate.execute("UPDATE cuves SET deleted = false WHERE deleted IS NULL");
        jdbcTemplate.execute("UPDATE cuves SET statut_physique = 'PROPRE' WHERE statut_physique IS NULL");

        jdbcTemplate.execute("ALTER TABLE cuves ALTER COLUMN volume_max SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE cuves ALTER COLUMN updated_at SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE cuves ALTER COLUMN created_at SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE cuves ALTER COLUMN deleted SET DEFAULT false");
        jdbcTemplate.execute("ALTER TABLE cuves ALTER COLUMN deleted SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE cuves ALTER COLUMN statut_physique SET DEFAULT 'PROPRE'");
        jdbcTemplate.execute("ALTER TABLE cuves ALTER COLUMN statut_physique SET NOT NULL");
    }

    private void repairLotsSchema(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("ALTER TABLE lots ADD COLUMN IF NOT EXISTS deleted boolean");
        jdbcTemplate.execute("ALTER TABLE lots ADD COLUMN IF NOT EXISTS deleted_at timestamp(6)");
        jdbcTemplate.execute("UPDATE lots SET deleted = false WHERE deleted IS NULL");
        jdbcTemplate.execute("ALTER TABLE lots ALTER COLUMN deleted SET DEFAULT false");
        jdbcTemplate.execute("ALTER TABLE lots ALTER COLUMN deleted SET NOT NULL");
    }
}
