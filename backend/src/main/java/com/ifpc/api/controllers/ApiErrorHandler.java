package com.ifpc.api.controllers;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Rend les refus applicatifs directement, sans passer par {@code /error}.
 *
 * <p>Sans ce gestionnaire, un {@link ResponseStatusException} levé par un
 * contrôleur est rendu par une répartition interne vers {@code /error}. Or
 * Spring Security 6 filtre aussi cette répartition, et la session étant
 * {@code STATELESS}, le contexte d'authentification n'y est plus : la règle
 * {@code anyRequest().authenticated()} refuse la répartition et le client
 * reçoit un <b>403 au corps vide</b>, quel que soit le refus d'origine.</p>
 *
 * <p>Un 400 « analyse sans jeton de calcul » arrivait ainsi au navigateur sous
 * la forme d'un 403 muet — impossible à diagnostiquer depuis l'écran.</p>
 *
 * <p>Les refus 4xx portent leur motif : ils sont écrits pour l'utilisateur. Les
 * erreurs 5xx n'exposent rien, seul le journal serveur en garde le détail.</p>
 */
@Slf4j
@RestControllerAdvice
public class ApiErrorHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> refusApplicatif(ResponseStatusException e) {
        HttpStatusCode statut = e.getStatusCode();
        boolean cotéClient = statut.is4xxClientError();

        if (cotéClient) {
            log.info("Requête refusée ({}) : {}", statut.value(), e.getReason());
        } else {
            log.error("Erreur serveur ({})", statut.value(), e);
        }

        Map<String, Object> corps = new LinkedHashMap<>();
        corps.put("timestamp", Instant.now().toString());
        corps.put("status", statut.value());
        corps.put("message", cotéClient && e.getReason() != null
                ? e.getReason()
                : "Une erreur interne est survenue.");

        return ResponseEntity.status(statut).body(corps);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> erreurInattendue(Exception e) {
        log.error("Erreur inattendue", e);

        Map<String, Object> corps = new LinkedHashMap<>();
        corps.put("timestamp", Instant.now().toString());
        corps.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        corps.put("message", "Une erreur interne est survenue.");

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(corps);
    }
}
