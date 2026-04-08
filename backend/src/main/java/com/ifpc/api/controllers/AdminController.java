package com.ifpc.api.controllers;

import com.ifpc.api.models.HelpText;
import com.ifpc.api.models.ProductConfig;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.HelpTextRepository;
import com.ifpc.api.repositories.ProductConfigRepository;
import com.ifpc.api.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final ProductConfigRepository productConfigRepository;
    private final HelpTextRepository helpTextRepository;

    // ── Admin-only endpoints ─────────────────────────────────────────────

    @GetMapping("/api/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        List<UserDto> users = userRepository.findAll().stream()
                .map(user -> new UserDto(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getRole().name(), user.isEnabled(), user.getLastLogin()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    @PutMapping("/api/admin/users/{userId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> updateUserRole(@PathVariable Long userId, @RequestBody RoleUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        try {
            Role newRole = Role.valueOf(request.role().toUpperCase());
            user.setRole(newRole);
            if (newRole != Role.PENDING) {
                user.setEnabled(true);
            }
            userRepository.save(user);
            return ResponseEntity.ok("Le rôle de " + user.getEmail() + " a été mis à jour vers " + newRole);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Rôle invalide. Utilisez PENDING, USER, EXPERT ou ADMIN.");
        }
    }

    @GetMapping("/api/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDto>> getPendingUsers() {
        List<UserDto> pending = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.PENDING)
                .map(u -> new UserDto(u.getId(), u.getFirstName(), u.getLastName(), u.getEmail(), u.getRole().name(), u.isEnabled(), u.getLastLogin()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(pending);
    }

    @PutMapping("/api/admin/users/{userId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> approveUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        user.setRole(Role.USER);
        user.setEnabled(true);
        userRepository.save(user);
        return ResponseEntity.ok("Utilisateur " + user.getEmail() + " approuvé.");
    }

    @DeleteMapping("/api/admin/users/{userId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> rejectUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        userRepository.delete(user);
        return ResponseEntity.ok("Utilisateur " + user.getEmail() + " rejeté et supprimé.");
    }

    // ── Product config (admin CRUD) ──────────────────────────────────────

    @GetMapping("/api/admin/product-config")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ProductConfig>> getProductConfigs() {
        return ResponseEntity.ok(productConfigRepository.findAll());
    }

    @PutMapping("/api/admin/product-config/{productType}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductConfig> upsertProductConfig(
            @PathVariable String productType,
            @RequestBody ProductConfigUpdateRequest request
    ) {
        ProductConfig config = productConfigRepository.findByProductType(productType)
                .orElse(ProductConfig.builder()
                        .productType(productType)
                        .productName(request.productName() != null ? request.productName() : productType)
                        .vpCible(request.vpCible())
                        .build());
        config.setVpCible(request.vpCible());
        if (request.productName() != null) {
            config.setProductName(request.productName());
        }
        productConfigRepository.save(config);
        return ResponseEntity.ok(config);
    }

    // ── Public config endpoint (no auth required) ────────────────────────

    @GetMapping("/api/config/products")
    public ResponseEntity<List<ProductConfigDto>> getPublicProductConfig() {
        List<ProductConfigDto> configs = productConfigRepository.findAll().stream()
                .map(c -> new ProductConfigDto(c.getProductType(), c.getProductName(), c.getVpCible()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(configs);
    }

    // ── Help text (admin write, public read) ─────────────────────────────

    @GetMapping("/api/config/help/{key}")
    public ResponseEntity<HelpTextDto> getHelpText(@PathVariable String key) {
        return helpTextRepository.findByTextKey(key)
                .map(h -> ResponseEntity.ok(new HelpTextDto(h.getTextKey(), h.getContent())))
                .orElse(ResponseEntity.ok(new HelpTextDto(key, null)));
    }

    @PutMapping("/api/admin/help/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HelpTextDto> updateHelpText(@PathVariable String key, @RequestBody HelpTextUpdateRequest request) {
        HelpText helpText = helpTextRepository.findByTextKey(key)
                .orElse(HelpText.builder().textKey(key).content("").build());
        helpText.setContent(request.content());
        helpTextRepository.save(helpText);
        return ResponseEntity.ok(new HelpTextDto(helpText.getTextKey(), helpText.getContent()));
    }

    // ── DTOs ─────────────────────────────────────────────────────────────

    public record UserDto(Long id, String firstName, String lastName, String email, String role, boolean enabled, LocalDateTime lastLogin) {}
    public record RoleUpdateRequest(String role) {}
    public record ProductConfigUpdateRequest(Double vpCible, String productName) {}
    public record ProductConfigDto(String productType, String productName, Double vpCible) {}
    public record HelpTextDto(String key, String content) {}
    public record HelpTextUpdateRequest(String content) {}
}
