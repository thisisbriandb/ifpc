package com.ifpc.api.controllers;

import com.ifpc.api.models.User;
import com.ifpc.api.services.EmailService;
import com.ifpc.api.services.SupportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Help desk : « Signaler un problème », depuis n'importe quel écran.
 *
 * <p>Réservé aux comptes connectés (règle par défaut de la chaîne de
 * sécurité) : une demande anonyme ne pourrait recevoir aucune réponse, et le
 * formulaire deviendrait une porte ouverte au spam sur le dépôt.</p>
 */
@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportService supportService;
    private final EmailService emailService;

    /** L'écran n'affiche le bouton que si une demande peut réellement partir. */
    @GetMapping("/statut")
    public Map<String, Object> statut() {
        return Map.of("actif", supportService.actif());
    }

    @PostMapping("/demandes")
    public ResponseEntity<Map<String, Object>> creer(@RequestBody SupportService.Demande demande) {
        User demandeur = utilisateurCourant();
        SupportService.Ticket ticket = supportService.creer(demande, demandeur.getEmail());
        emailService.sendSupportTicketNotification(demandeur, ticket.numero(), ticket.url(),
                demande.titre().strip(), ticket.reference());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "numero", ticket.numero(),
                "url", ticket.url()));
    }

    private User utilisateurCourant() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof User user) {
            return user;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise");
    }
}
