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
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

@Configuration
@RequiredArgsConstructor
public class DatabaseSeeder {

    @Bean
    public CommandLineRunner seedDatabase(
            UserRepository userRepository,
            ProductConfigRepository productConfigRepository,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {
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
}
