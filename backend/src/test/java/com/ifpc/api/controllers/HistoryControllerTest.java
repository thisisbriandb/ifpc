package com.ifpc.api.controllers;

import com.ifpc.api.models.AnalysisHistory;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.AnalysisHistoryRepository;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HistoryControllerTest {

    @Mock private AnalysisHistoryRepository historyRepository;

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

        HistoryController.SaveAnalysisRequest req = new HistoryController.SaveAnalysisRequest(
                "bareme", "Analyse Pasteurisation", "LOT-100", "conforme",
                15.5, 15.0, "{}", "[]", "{}"
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
    @DisplayName("getRecentHistory returns history list for authenticated user and empty for anonymous")
    void testGetRecentHistory() {
        User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        AnalysisHistory ah = AnalysisHistory.builder()
                .id(1L).type("bareme").label("Test").lotIdentifier("L1").statut("ok")
                .vp(15.0).vpCible(15.0).parametres("{}").createdAt(LocalDateTime.now())
                .userEmail("tech@ifpc.eu").build();

        when(historyRepository.findTop50ByUserEmailOrderByCreatedAtDesc("tech@ifpc.eu")).thenReturn(List.of(ah));

        ResponseEntity<List<HistoryController.HistoryDto>> response = historyController.getRecentHistory();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());

        SecurityContextHolder.clearContext();
        ResponseEntity<List<HistoryController.HistoryDto>> anonResp = historyController.getRecentHistory();
        assertEquals(HttpStatus.OK, anonResp.getStatusCode());
        assertEquals(0, anonResp.getBody().size());
    }

    @Test
    @DisplayName("getAnalysis by ID returns item or 404")
    void testGetAnalysis() {
        AnalysisHistory ah = AnalysisHistory.builder().id(1L).build();
        when(historyRepository.findById(1L)).thenReturn(Optional.of(ah));
        when(historyRepository.findById(2L)).thenReturn(Optional.empty());

        ResponseEntity<AnalysisHistory> resp1 = historyController.getAnalysis(1L);
        assertEquals(HttpStatus.OK, resp1.getStatusCode());

        ResponseEntity<AnalysisHistory> resp2 = historyController.getAnalysis(2L);
        assertEquals(HttpStatus.NOT_FOUND, resp2.getStatusCode());
    }

    @Test
    @DisplayName("deleteAnalysis deletes user's own analysis and returns 404 otherwise")
    void testDeleteAnalysis() {
        User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        AnalysisHistory own = AnalysisHistory.builder().id(1L).userEmail("tech@ifpc.eu").build();
        AnalysisHistory other = AnalysisHistory.builder().id(2L).userEmail("other@ifpc.eu").build();

        when(historyRepository.findById(1L)).thenReturn(Optional.of(own));
        when(historyRepository.findById(2L)).thenReturn(Optional.of(other));

        ResponseEntity<Void> resp1 = historyController.deleteAnalysis(1L);
        assertEquals(HttpStatus.OK, resp1.getStatusCode());
        verify(historyRepository).delete(own);

        ResponseEntity<Void> resp2 = historyController.deleteAnalysis(2L);
        assertEquals(HttpStatus.NOT_FOUND, resp2.getStatusCode());
    }
}
