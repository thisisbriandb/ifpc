package com.ifpc.api.controllers;

import com.ifpc.api.models.AuditAction;
import com.ifpc.api.models.AuditLog;
import com.ifpc.api.models.HelpText;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.AuditLogRepository;
import com.ifpc.api.repositories.HelpTextRepository;
import com.ifpc.api.repositories.UserRepository;
import com.ifpc.api.services.AuditService;
import com.ifpc.api.services.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final HelpTextRepository helpTextRepository;
    private final EmailService emailService;
    private final AuditService auditService;
    private final AuditLogRepository auditLogRepository;

    // ── Admin-only endpoints ─────────────────────────────────────────────

    @GetMapping("/api/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        List<UserDto> users = userRepository.findAll().stream()
                .map(user -> new UserDto(user.getId(), user.getFirstName(), user.getLastName(), user.getCompanyName(), user.getCompanyRole(), user.getEmail(), user.getRole().name(), user.isEnabled(), user.getLastLogin()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    @PutMapping("/api/admin/users/{userId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> updateUserRole(@PathVariable Long userId, @RequestBody RoleUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        try {
            Role oldRole = user.getRole();
            Role newRole = Role.valueOf(request.role().toUpperCase());
            user.setRole(newRole);
            if (newRole != Role.PENDING) {
                user.setEnabled(true);
            }
            userRepository.save(user);

            auditService.consigner(AuditAction.ROLE_MODIFIE, "utilisateur", user.getEmail(),
                    Map.of("avant", oldRole.name(), "apres", newRole.name()));

            if (oldRole == Role.PENDING && newRole != Role.PENDING) {
                emailService.sendAccountApprovedNotification(user);
            }

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
                .map(u -> new UserDto(u.getId(), u.getFirstName(), u.getLastName(), u.getCompanyName(), u.getCompanyRole(), u.getEmail(), u.getRole().name(), u.isEnabled(), u.getLastLogin()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(pending);
    }

    @PutMapping("/api/admin/users/{userId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> approveUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        Role avant = user.getRole();
        user.setRole(Role.USER);
        user.setEnabled(true);
        userRepository.save(user);

        auditService.consigner(AuditAction.COMPTE_APPROUVE, "utilisateur", user.getEmail(),
                Map.of("avant", String.valueOf(avant), "apres", Role.USER.name()));

        emailService.sendAccountApprovedNotification(user);

        return ResponseEntity.ok("Utilisateur " + user.getEmail() + " approuvé.");
    }

    @DeleteMapping("/api/admin/users/{userId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> rejectUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        userRepository.delete(user);

        auditService.consigner(AuditAction.COMPTE_SUPPRIME, "utilisateur", user.getEmail(),
                Map.of("motif", "demande rejetée", "role", String.valueOf(user.getRole())));

        return ResponseEntity.ok("Utilisateur " + user.getEmail() + " rejeté et supprimé.");
    }

    @DeleteMapping("/api/admin/users/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> deleteUser(@PathVariable Long userId, org.springframework.security.core.Authentication authentication) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if (authentication != null && authentication.getName().equalsIgnoreCase(user.getEmail())) {
            return ResponseEntity.badRequest().body("Vous ne pouvez pas supprimer votre propre compte d'administrateur.");
        }

        userRepository.delete(user);

        // Les lots, cuves et analyses restent rattachés à cette adresse : le
        // journal garde donc trace du propriétaire de données désormais sans
        // titulaire.
        auditService.consigner(AuditAction.COMPTE_SUPPRIME, "utilisateur", user.getEmail(),
                Map.of("motif", "suppression administrateur", "role", String.valueOf(user.getRole())));

        return ResponseEntity.ok("Utilisateur " + user.getEmail() + " supprimé avec succès.");
    }

    // ── Journal d'audit (lecture admin) ──────────────────────────────────

    /**
     * Les 200 dernières opérations consignées, de la plus récente à la plus
     * ancienne. Aucun point d'entrée ne permet d'en supprimer : le journal est
     * en ajout seul.
     */
    @GetMapping("/api/admin/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AuditLog>> getAuditLog(@RequestParam(required = false) String cibleType) {
        return ResponseEntity.ok(cibleType == null || cibleType.isBlank()
                ? auditLogRepository.findTop200ByOrderByCreatedAtDesc()
                : auditLogRepository.findTop200ByCibleTypeOrderByCreatedAtDesc(cibleType));
    }

    // ── Help text (admin write, public read) ─────────────────────────────

    @GetMapping("/api/config/help/{key}")
    public ResponseEntity<HelpTextDto> getHelpText(@PathVariable String key, @RequestParam(defaultValue = "fr") String locale) {
        String normalizedLocale = normalizeLocale(locale);
        String localizedKey = localizedHelpKey(key, normalizedLocale);
        return helpTextRepository.findByTextKey(localizedKey)
                .or(() -> helpTextRepository.findByTextKey(key))
                .map(h -> ResponseEntity.ok(new HelpTextDto(key, h.getContent(), normalizedLocale)))
                .orElse(ResponseEntity.ok(new HelpTextDto(key, null, normalizedLocale)));
    }

    @PutMapping("/api/admin/help/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HelpTextDto> updateHelpText(@PathVariable String key, @RequestBody HelpTextUpdateRequest request) {
        String normalizedLocale = normalizeLocale(request.locale());
        String localizedKey = localizedHelpKey(key, normalizedLocale);
        HelpText helpText = helpTextRepository.findByTextKey(localizedKey)
                .orElse(HelpText.builder().textKey(localizedKey).content("").build());
        helpText.setContent(request.content());
        helpTextRepository.save(helpText);
        return ResponseEntity.ok(new HelpTextDto(key, helpText.getContent(), normalizedLocale));
    }

    private static String normalizeLocale(String locale) {
        String value = locale == null ? "fr" : locale.toLowerCase(Locale.ROOT);
        return value.equals("en") ? "en" : "fr";
    }

    private static String localizedHelpKey(String key, String locale) {
        return key + "__" + locale;
    }

    // ── DTOs ─────────────────────────────────────────────────────────────

    public record UserDto(Long id, String firstName, String lastName, String companyName, String companyRole, String email, String role, boolean enabled, LocalDateTime lastLogin) {}
    public record RoleUpdateRequest(String role) {}
    public record HelpTextDto(String key, String content, String locale) {}
    public record HelpTextUpdateRequest(String content, String locale) {}
}
