package com.ifpc.api.controllers;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.UserRepository;
import com.ifpc.api.security.JwtService;
import com.ifpc.api.services.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;

    public AuthenticationResponse register(RegisterRequest request) {
        var user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .companyName(request.getCompanyName())
                .companyRole(request.getCompanyRole())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.PENDING)
                .enabled(false)
                .build();
        repository.save(user);

        emailService.sendNewRegistrationNotification(user);

        return AuthenticationResponse.builder()
                .token(null)
                .message("Inscription enregistrée. Votre compte est en attente de validation par un administrateur.")
                .pending(true)
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        var user = repository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if (user.getRole() == Role.PENDING || !user.isEnabled()) {
            return AuthenticationResponse.builder()
                    .token(null)
                    .message("Votre compte est en attente de validation par un administrateur.")
                    .pending(true)
                    .build();
        }

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        user.setLastLogin(LocalDateTime.now());
        repository.save(user);
        var jwtToken = jwtService.generateToken(user);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .message(null)
                .pending(false)
                .build();
    }

    public MessageResponse forgotPassword(String email, String appBaseUrl) {
        if (email != null && !email.isBlank()) {
            repository.findByEmail(email.trim()).ifPresent(user -> {
                String token = java.util.UUID.randomUUID().toString();
                user.setResetPasswordToken(token);
                user.setResetPasswordTokenExpiry(LocalDateTime.now().plusHours(1));
                repository.save(user);

                emailService.sendPasswordResetNotification(user, token, appBaseUrl);
            });
        }
        return new MessageResponse("Si un compte avec cette adresse e-mail existe, un lien de réinitialisation y a été envoyé.");
    }

    public boolean verifyResetToken(String token) {
        if (token == null || token.isBlank()) return false;
        return repository.findByResetPasswordToken(token)
                .map(user -> user.getResetPasswordTokenExpiry() != null && user.getResetPasswordTokenExpiry().isAfter(LocalDateTime.now()))
                .orElse(false);
    }

    public MessageResponse resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw new RuntimeException("Jeton de réinitialisation manquant.");
        }
        var user = repository.findByResetPasswordToken(token)
                .orElseThrow(() -> new RuntimeException("Jeton invalide ou introuvable."));

        if (user.getResetPasswordTokenExpiry() == null || user.getResetPasswordTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Le lien de réinitialisation a expiré. Veuillez refaire une demande.");
        }

        if (newPassword == null || newPassword.length() < 6) {
            throw new RuntimeException("Le nouveau mot de passe doit contenir au moins 6 caractères.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetPasswordToken(null);
        user.setResetPasswordTokenExpiry(null);
        repository.save(user);

        return new MessageResponse("Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.");
    }

    public record MessageResponse(String message) {}
}
