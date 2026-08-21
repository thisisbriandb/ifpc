package com.ifpc.api.security;

import com.ifpc.api.models.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

/**
 * Cloisonnement multi-locataire.
 *
 * <p>Chaque utilisateur dispose de son propre jeu de données (lots, cuves,
 * stockages, opérations, historique) : son adresse e-mail sert de clé de
 * locataire. Toute lecture comme toute écriture des ressources métier passe
 * par ici, afin qu'un utilisateur X ne puisse jamais atteindre les données
 * d'un utilisateur Y.</p>
 *
 * <p>Le jour où le cloisonnement devra se faire par exploitation plutôt que
 * par personne, seul {@link #currentEmail()} sera à modifier (renvoyer
 * l'identifiant d'organisation) : le reste du code n'en sait rien.</p>
 */
public final class Tenant {

    private Tenant() {
    }

    /** Clé du locataire courant, ou {@code null} si la requête est anonyme. */
    public static String currentEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof User user) {
            return user.getEmail();
        }
        return null;
    }

    /** Idem, mais refuse la requête si aucun utilisateur n'est authentifié. */
    public static String requireCurrentEmail() {
        String email = currentEmail();
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise");
        }
        return email;
    }

    /** Vrai si la ressource appartient bien au locataire indiqué. */
    public static boolean owns(String ownerEmail, String tenantEmail) {
        return ownerEmail != null && tenantEmail != null && ownerEmail.equalsIgnoreCase(tenantEmail);
    }
}
