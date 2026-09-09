package com.ifpc.api.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Un refus applicatif arrive au client avec son motif.
 *
 * <p>Le défaut d'origine : un {@link ResponseStatusException} était rendu par
 * une répartition interne vers {@code /error}, elle-même filtrée par Spring
 * Security en session sans état. Le client recevait un 403 au corps vide quel
 * que soit le refus — un 400 « analyse sans jeton de calcul » ressortait en
 * 403 muet, indiagnosticable depuis l'écran.</p>
 */
class ApiErrorHandlerTest {

    private final ApiErrorHandler handler = new ApiErrorHandler();

    @ParameterizedTest
    @ValueSource(ints = {400, 403, 404, 409})
    @DisplayName("un refus 4xx conserve son statut et son motif")
    void unRefusClientPorteSonMotif(int statut) {
        String motif = "Un contrôle de pasteurisation ne peut être enregistré que depuis "
                + "un résultat du moteur de calcul.";

        ResponseEntity<Map<String, Object>> reponse = handler.refusApplicatif(
                new ResponseStatusException(HttpStatus.valueOf(statut), motif));

        assertEquals(statut, reponse.getStatusCode().value());
        assertNotNull(reponse.getBody());
        assertEquals(statut, reponse.getBody().get("status"));
        assertEquals(motif, reponse.getBody().get("message"));
    }

    @Test
    @DisplayName("le corps n'est jamais vide : c'est ce qui rendait le diagnostic impossible")
    void leCorpsNEstJamaisVide() {
        ResponseEntity<Map<String, Object>> reponse = handler.refusApplicatif(
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Résultat de calcul non authentifié."));

        assertNotNull(reponse.getBody());
        assertFalse(reponse.getBody().isEmpty());
        assertTrue(reponse.getBody().containsKey("timestamp"));
    }

    @Test
    @DisplayName("une erreur serveur n'expose pas son détail")
    void uneErreurServeurNExposeRien() {
        ResponseEntity<Map<String, Object>> reponse = handler.refusApplicatif(
                new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "connexion base perdue sur db-prod-7:5432"));

        assertEquals(500, reponse.getStatusCode().value());
        assertNotNull(reponse.getBody());
        assertEquals("Une erreur interne est survenue.", reponse.getBody().get("message"));
        assertFalse(reponse.getBody().toString().contains("db-prod-7"));
    }

    @Test
    @DisplayName("une exception inattendue ne fuit pas son message")
    void uneExceptionInattendueNeFuitPas() {
        ResponseEntity<Map<String, Object>> reponse = handler.erreurInattendue(
                new IllegalStateException("mot de passe = hunter2"));

        assertEquals(500, reponse.getStatusCode().value());
        assertNotNull(reponse.getBody());
        assertEquals("Une erreur interne est survenue.", reponse.getBody().get("message"));
        assertFalse(reponse.getBody().toString().contains("hunter2"));
    }

    @Test
    @DisplayName("un mot de passe faux vaut 401, pas 500")
    void unMotDePasseFauxVaut401() {
        // Le catch-all rendait « Une erreur interne est survenue » : la page de
        // connexion ne pouvait pas dire à l'utilisateur ce qui n'allait pas.
        ResponseEntity<Map<String, Object>> reponse = handler.echecAuthentification(
                new BadCredentialsException("Bad credentials"));

        assertEquals(401, reponse.getStatusCode().value());
        assertNotNull(reponse.getBody());
        assertEquals(401, reponse.getBody().get("status"));
        assertEquals("Identifiants invalides.", reponse.getBody().get("message"));
    }

    @Test
    @DisplayName("le motif d'échec n'apprend rien sur l'existence du compte")
    void leMotifNEnumerePasLesComptes() {
        // Deux causes distinctes, un seul motif rendu : sinon la page de
        // connexion devient un annuaire des adresses ayant un compte.
        String motDePasseFaux = handler.echecAuthentification(
                new BadCredentialsException("Bad credentials")).getBody().get("message").toString();
        String compteInconnu = handler.echecAuthentification(
                new BadCredentialsException("Identifiants invalides")).getBody().get("message").toString();

        assertEquals(motDePasseFaux, compteInconnu);
    }
}
