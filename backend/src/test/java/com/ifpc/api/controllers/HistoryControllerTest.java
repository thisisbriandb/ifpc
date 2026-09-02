package com.ifpc.api.controllers;

import com.ifpc.api.models.AnalysisHistory;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.AnalysisHistoryRepository;
import com.ifpc.api.services.AuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HistoryControllerTest {

    @Mock private AnalysisHistoryRepository historyRepository;
    @Mock private AuditService auditService;

    @InjectMocks private HistoryController historyController;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("saveAnalysis saves and returns analysis history")
    void testSaveAnalysis() {
        User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        // Type sans verdict sanitaire : les champs restent déclaratifs et
        // aucun jeton n'est exigé (cf. HistoryScellementTest pour un contrôle).
        HistoryController.SaveAnalysisRequest req = new HistoryController.SaveAnalysisRequest(
                "bareme", "Analyse Pasteurisation", "LOT-100", "conforme",
                15.5, 15.0, "{}", "[]", "{}", null
        );

        AnalysisHistory saved = AnalysisHistory.builder()
                .id(1L)
                .type("bareme")
                .label("Analyse Pasteurisation")
                .userEmail("tech@ifpc.eu")
                .build();

        when(historyRepository.save(any(AnalysisHistory.class))).thenReturn(saved);

        ResponseEntity<AnalysisHistory> response = historyController.saveAnalysis(req);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("tech@ifpc.eu", response.getBody().getUserEmail());
    }

    @Test
    @DisplayName("getRecentHistory returns history list for authenticated user and rejects anonymous")
    void testGetRecentHistory() {
        User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        AnalysisHistory ah = AnalysisHistory.builder()
                .id(1L).type("bareme").label("Test").lotIdentifier("L1").statut("ok")
                .vp(15.0).vpCible(15.0).parametres("{}").createdAt(LocalDateTime.now())
                .userEmail("tech@ifpc.eu").build();

        when(historyRepository.findTop50ByUserEmailAndDeletedFalseOrderByCreatedAtDesc("tech@ifpc.eu")).thenReturn(List.of(ah));

        ResponseEntity<List<HistoryController.HistoryDto>> response = historyController.getRecentHistory();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());

        SecurityContextHolder.clearContext();
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> historyController.getRecentHistory());
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("getAnalysis by ID returns the tenant's own item, 404 for anyone else's")
    void testGetAnalysis() {
        User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        AnalysisHistory ah = AnalysisHistory.builder().id(1L).userEmail("tech@ifpc.eu").build();
        when(historyRepository.findByIdAndUserEmailAndDeletedFalse(1L, "tech@ifpc.eu")).thenReturn(Optional.of(ah));
        // L'analyse 2 appartient à un autre utilisateur : le dépôt ne la rend pas
        when(historyRepository.findByIdAndUserEmailAndDeletedFalse(2L, "tech@ifpc.eu")).thenReturn(Optional.empty());

        ResponseEntity<AnalysisHistory> resp1 = historyController.getAnalysis(1L);
        assertEquals(HttpStatus.OK, resp1.getStatusCode());

        ResponseEntity<AnalysisHistory> resp2 = historyController.getAnalysis(2L);
        assertEquals(HttpStatus.NOT_FOUND, resp2.getStatusCode());
    }

    @Test
    @DisplayName("deleteAnalysis marque l'analyse du locataire supprimée, 404 sinon")
    void testDeleteAnalysis() {
        User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        AnalysisHistory own = AnalysisHistory.builder().id(1L).userEmail("tech@ifpc.eu").build();

        when(historyRepository.findByIdAndUserEmailAndDeletedFalse(1L, "tech@ifpc.eu")).thenReturn(Optional.of(own));
        // L'analyse 2 appartient à other@ifpc.eu : invisible pour ce locataire
        when(historyRepository.findByIdAndUserEmailAndDeletedFalse(2L, "tech@ifpc.eu")).thenReturn(Optional.empty());

        ResponseEntity<Void> resp1 = historyController.deleteAnalysis(1L);
        assertEquals(HttpStatus.OK, resp1.getStatusCode());
        // Suppression logique : l'analyse est marquée, jamais retirée de la base
        verify(historyRepository).save(own);
        verify(historyRepository, never()).delete(any());
        assertTrue(own.getDeleted());

        ResponseEntity<Void> resp2 = historyController.deleteAnalysis(2L);
        assertEquals(HttpStatus.NOT_FOUND, resp2.getStatusCode());
    }
}
