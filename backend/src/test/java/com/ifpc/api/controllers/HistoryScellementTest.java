package com.ifpc.api.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ifpc.api.models.AnalysisHistory;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.AnalysisHistoryRepository;
import com.ifpc.api.security.JwtService;
import com.ifpc.api.services.AuditService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Scellement des contrôles de pasteurisation.
 *
 * <p>Le défaut d'origine : le statut, la VP et les paramètres arrivaient tels
 * quels dans le corps de la requête et étaient archivés sans vérification.
 * Tout utilisateur authentifié pouvait donc déposer un « conforme » de son
 * choix, ce qui ôtait toute valeur probante au registre.</p>
 */
@ExtendWith(MockitoExtension.class)
class HistoryScellementTest {

    private static final String JETON = "jeton.signe.par.le.moteur";

    @Mock private AnalysisHistoryRepository historyRepository;
    @Mock private JwtService jwtService;
    @Mock private AuditService auditService;

    private HistoryController controller;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        controller = new HistoryController(historyRepository, jwtService, new ObjectMapper(), auditService);
    }

    /** Ce que le moteur a réellement calculé. */
    private Claims claimsDuMoteur() {
        Claims claims = Jwts.claims();
        claims.setId("a1b2c3");
        claims.put("typ_resultat", "controle");
        claims.put("statut", "insuffisant");
        claims.put("vp", 31.0);
        claims.put("vp_cible", 417.0);
        claims.put("k_calc", 1.1);
        claims.put("parametres", Map.of("microorganisme_key", "alicyclo_std", "t_ref", 95.0));
        return claims;
    }

    /** Ce que le client prétend, à l'opposé du calcul. */
    private HistoryController.SaveAnalysisRequest requeteMensongere() {
        return new HistoryController.SaveAnalysisRequest(
                "controle", "Lot du 2 septembre", "LOT-2026-114",
                "conforme", 9999.0, 1.0,
                "{\"microorganisme_key\":\"saccharo_jus\"}", "[]", "{}", JETON);
    }

    private AnalysisHistory capturerEnregistrement() {
        ArgumentCaptor<AnalysisHistory> capture = ArgumentCaptor.forClass(AnalysisHistory.class);
        verify(historyRepository).save(capture.capture());
        return capture.getValue();
    }

    @Test
    @DisplayName("le verdict vient du jeton, pas du corps de la requête")
    void leVerdictVientDuJeton() {
        when(jwtService.lireClaims(JETON)).thenReturn(claimsDuMoteur());
        when(historyRepository.save(any(AnalysisHistory.class))).thenAnswer(i -> i.getArgument(0));

        controller.saveAnalysis(requeteMensongere());

        AnalysisHistory enregistre = capturerEnregistrement();
        assertEquals("insuffisant", enregistre.getStatut(), "le « conforme » du client ne doit pas passer");
        assertEquals(31.0, enregistre.getVp());
        assertEquals(417.0, enregistre.getVpCible());
        assertTrue(enregistre.getParametres().contains("alicyclo_std"));
        assertFalse(enregistre.getParametres().contains("saccharo_jus"));
    }

    @Test
    @DisplayName("l'enregistrement conserve le jeton et se déclare scellé")
    void lEnregistrementEstTracable() {
        when(jwtService.lireClaims(JETON)).thenReturn(claimsDuMoteur());
        when(historyRepository.save(any(AnalysisHistory.class))).thenAnswer(i -> i.getArgument(0));

        controller.saveAnalysis(requeteMensongere());

        AnalysisHistory enregistre = capturerEnregistrement();
        assertTrue(enregistre.getScelle());
        assertEquals(JETON, enregistre.getJetonResultat());
        assertEquals("a1b2c3", enregistre.getResultatJti());
    }

    @Test
    @DisplayName("les métadonnées saisies par l'opérateur sont conservées")
    void lesMetadonneesDeLOperateurSontConservees() {
        when(jwtService.lireClaims(JETON)).thenReturn(claimsDuMoteur());
        when(historyRepository.save(any(AnalysisHistory.class))).thenAnswer(i -> i.getArgument(0));

        controller.saveAnalysis(requeteMensongere());

        AnalysisHistory enregistre = capturerEnregistrement();
        assertEquals("LOT-2026-114", enregistre.getLotIdentifier());
        assertEquals("Lot du 2 septembre", enregistre.getLabel());
        assertEquals("tech@ifpc.eu", enregistre.getUserEmail());
    }

    @Test
    @DisplayName("un contrôle sans jeton est refusé")
    void unControleSansJetonEstRefuse() {
        HistoryController.SaveAnalysisRequest sansJeton = new HistoryController.SaveAnalysisRequest(
                "controle", "Lot", "LOT-1", "conforme", 9999.0, 1.0, "{}", "[]", "{}", null);

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> controller.saveAnalysis(sansJeton));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatusCode());
        verify(historyRepository, never()).save(any());
    }

    @Test
    @DisplayName("un jeton dont la signature ne tient pas est refusé")
    void unJetonInvalideEstRefuse() {
        when(jwtService.lireClaims(JETON)).thenThrow(new SignatureException("signature invalide"));

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> controller.saveAnalysis(requeteMensongere()));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatusCode());
        verify(historyRepository, never()).save(any());
    }

    @Test
    @DisplayName("un jeton d'un autre type ne vaut pas contrôle de pasteurisation")
    void unJetonDUnAutreTypeEstRefuse() {
        Claims autre = claimsDuMoteur();
        autre.put("typ_resultat", "assemblage");
        when(jwtService.lireClaims(JETON)).thenReturn(autre);

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> controller.saveAnalysis(requeteMensongere()));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatusCode());
        verify(historyRepository, never()).save(any());
    }

    @Test
    @DisplayName("un même résultat ne peut pas être rejoué sur un second lot")
    void unResultatNePeutPasEtreRejoue() {
        when(jwtService.lireClaims(JETON)).thenReturn(claimsDuMoteur());
        when(historyRepository.save(any(AnalysisHistory.class)))
                .thenThrow(new DataIntegrityViolationException("resultat_jti déjà utilisé"));

        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> controller.saveAnalysis(requeteMensongere()));
        assertEquals(HttpStatus.CONFLICT, e.getStatusCode());
    }

    @Test
    @DisplayName("une analyse sans verdict sanitaire reste déclarative et non scellée")
    void uneAnalyseSansVerdictResteDeclarative() {
        when(historyRepository.save(any(AnalysisHistory.class))).thenAnswer(i -> i.getArgument(0));

        controller.saveAnalysis(new HistoryController.SaveAnalysisRequest(
                "assemblage", "Assemblage L*45", null, "REUSSI", 1.2, null, "{}", null, "{}", null));

        AnalysisHistory enregistre = capturerEnregistrement();
        assertEquals("assemblage", enregistre.getType());
        assertEquals("REUSSI", enregistre.getStatut());
        assertFalse(enregistre.getScelle(), "la distinction scellé / déclaratif doit rester lisible");
        assertNull(enregistre.getJetonResultat());
    }
}
