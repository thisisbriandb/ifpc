package com.ifpc.api.config;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@RequiredArgsConstructor
public class DatabaseSeeder {

    @Bean
    public CommandLineRunner seedDatabase(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            // Création de l'admin par défaut s'il n'existe pas
            if (userRepository.findByEmail("admin@ifpc.com").isEmpty()) {
                User admin = User.builder()
                        .firstName("Super")
                        .lastName("Admin")
                        .email("admin@ifpc.com")
                        .password(passwordEncoder.encode("admin"))
                        .role(Role.ADMIN)
                        .build();
                userRepository.save(admin);
                System.out.println("====== COMPTE ADMIN GÉNÉRÉ ======");
                System.out.println("Email: admin@ifpc.com");
                System.out.println("Mot de passe: admin");
                System.out.println("=================================");
            }
        };
    }
}
