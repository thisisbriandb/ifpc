package com.ifpc.api.config;

import com.ifpc.api.models.ProductConfig;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.ProductConfigRepository;
import com.ifpc.api.repositories.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DatabaseSeederTest {

    @Mock private UserRepository userRepository;
    @Mock private ProductConfigRepository productConfigRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("seedDatabase executes schema repair and seeds admin and product configs when empty")
    void testSeedDatabaseEmpty() throws Exception {
        DatabaseSeeder seeder = new DatabaseSeeder();

        when(userRepository.findByEmail("admin@ifpc.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("admin")).thenReturn("encodedAdmin");
        when(productConfigRepository.findByProductType(anyString())).thenReturn(Optional.empty());

        CommandLineRunner runner = seeder.seedDatabase(
                userRepository,
                productConfigRepository,
                passwordEncoder,
                jdbcTemplate
        );

        runner.run();

        verify(userRepository).save(any(User.class));
        verify(productConfigRepository, atLeast(1)).save(any(ProductConfig.class));
        verify(jdbcTemplate, atLeastOnce()).execute(anyString());
    }

    @Test
    @DisplayName("seedDatabase skips admin creation if already existing")
    void testSeedDatabaseExistingAdmin() throws Exception {
        DatabaseSeeder seeder = new DatabaseSeeder();

        User existingAdmin = User.builder().email("admin@ifpc.com").build();
        when(userRepository.findByEmail("admin@ifpc.com")).thenReturn(Optional.of(existingAdmin));
        when(productConfigRepository.findByProductType(anyString())).thenReturn(Optional.of(new ProductConfig()));

        CommandLineRunner runner = seeder.seedDatabase(
                userRepository,
                productConfigRepository,
                passwordEncoder,
                jdbcTemplate
        );

        runner.run();

        verify(userRepository, never()).save(any(User.class));
        verify(productConfigRepository, never()).save(any(ProductConfig.class));
    }
}
