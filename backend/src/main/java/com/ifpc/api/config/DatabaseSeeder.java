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

    private void repairCuvesSchema(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS volume_max double precision");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS updated_at timestamp(6)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS created_at timestamp(6)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS deleted boolean");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS deleted_at timestamp(6)");
        jdbcTemplate.execute("ALTER TABLE cuves ADD COLUMN IF NOT EXISTS statut_physique varchar(30)");

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
        jdbcTemplate.execute("UPDATE cuves SET volume_max = COALESCE(volume_max, 1000) WHERE volume_max IS NULL");
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
}
