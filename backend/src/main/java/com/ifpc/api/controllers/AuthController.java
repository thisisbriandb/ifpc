package com.ifpc.api.controllers;

import com.ifpc.api.models.User;
import com.ifpc.api.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationService service;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/register")
    public ResponseEntity<AuthenticationResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(service.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthenticationResponse> authenticate(@RequestBody AuthenticationRequest request) {
        return ResponseEntity.ok(service.authenticate(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> getMe() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getPrincipal().equals("anonymousUser")) {
            return ResponseEntity.status(401).build();
        }
        
        User user = (User) authentication.getPrincipal();
        return ResponseEntity.ok(new UserDto(user.getFirstName(), user.getLastName(), user.getCompanyName(),
                user.getCompanyRole(), user.getEmail(), user.getRole().name()));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody ProfileUpdateRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getPrincipal().equals("anonymousUser")) {
            return ResponseEntity.status(401).build();
        }
        User user = (User) authentication.getPrincipal();
        if (request.firstName() != null) user.setFirstName(request.firstName());
        if (request.lastName() != null) user.setLastName(request.lastName());
        if (request.companyName() != null) user.setCompanyName(request.companyName());
        if (request.companyRole() != null) user.setCompanyRole(request.companyRole());
        userRepository.save(user);
        return ResponseEntity.ok(new UserDto(user.getFirstName(), user.getLastName(), user.getCompanyName(),
                user.getCompanyRole(), user.getEmail(), user.getRole().name()));
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody PasswordChangeRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getPrincipal().equals("anonymousUser")) {
            return ResponseEntity.status(401).build();
        }
        User user = (User) authentication.getPrincipal();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Mot de passe actuel incorrect."));
        }
        if (request.newPassword() == null || request.newPassword().length() < 6) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Le nouveau mot de passe doit contenir au moins 6 caractères."));
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return ResponseEntity.ok(new MessageResponse("Mot de passe modifié avec succès."));
    }
    
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(
            @RequestBody ForgotPasswordRequest request,
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "Referer", required = false) String referer) {
        String appBaseUrl = origin;
        if ((appBaseUrl == null || appBaseUrl.isBlank()) && referer != null && !referer.isBlank()) {
            try {
                java.net.URI uri = new java.net.URI(referer);
                appBaseUrl = uri.getScheme() + "://" + uri.getAuthority();
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(service.forgotPassword(request.email(), appBaseUrl));
    }

    @GetMapping("/verify-reset-token")
    public ResponseEntity<?> verifyResetToken(@RequestParam("token") String token) {
        boolean valid = service.verifyResetToken(token);
        if (!valid) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Jeton invalide ou expiré."));
        }
        return ResponseEntity.ok(new MessageResponse("Jeton valide."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordApiRequest request) {
        try {
            return ResponseEntity.ok(service.resetPassword(request.token(), request.newPassword()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    /**
     * Profil renvoyé au client.
     *
     * <p>L'entreprise et la fonction en étaient absentes : le formulaire de
     * profil les affichait donc vides même une fois enregistrées, puisqu'il se
     * remplit à partir de cette réponse.</p>
     */
    public record UserDto(String firstName, String lastName, String companyName,
                          String companyRole, String email, String role) {}

    /**
     * Champs modifiables depuis le profil.
     *
     * <p>{@code companyName} et {@code companyRole} en étaient absents. Le
     * client les envoyait, Jackson les écartait en silence — la configuration
     * par défaut de Spring Boot ignore les propriétés inconnues — et
     * l'enregistrement répondait 200 sans les avoir écrits.</p>
     */
    public record ProfileUpdateRequest(String firstName, String lastName,
                                       String companyName, String companyRole) {}
    public record PasswordChangeRequest(String currentPassword, String newPassword) {}
    public record ForgotPasswordRequest(String email) {}
    public record ResetPasswordApiRequest(String token, String newPassword) {}
    public record ErrorResponse(String error) {}
    public record MessageResponse(String message) {}
}
