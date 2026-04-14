package com.ifpc.api.controllers;

import com.ifpc.api.models.AnalysisHistory;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.AnalysisHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class HistoryController {

    private final AnalysisHistoryRepository historyRepository;

    // ── Sauvegarder une analyse ───────────────────────────────────────────
    @PostMapping
    public ResponseEntity<AnalysisHistory> saveAnalysis(@RequestBody SaveAnalysisRequest request) {
        String email = getCurrentUserEmail();

        AnalysisHistory history = AnalysisHistory.builder()
                .type(request.type())
                .label(request.label())
                .lotIdentifier(request.lotIdentifier())
                .statut(request.statut())
                .vp(request.vp())
                .vpCible(request.vpCible())
                .parametres(request.parametres())
                .courbe(request.courbe())
                .resultJson(request.resultJson())
                .userEmail(email)
                .build();

        return ResponseEntity.ok(historyRepository.save(history));
    }

    // ── Lister les analyses récentes ──────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<HistoryDto>> getRecentHistory() {
        String email = getCurrentUserEmail();

        List<AnalysisHistory> analyses;
        if (email != null) {
            analyses = historyRepository.findTop50ByUserEmailOrderByCreatedAtDesc(email);
        } else {
            analyses = List.of();
        }

        List<HistoryDto> dtos = analyses.stream()
                .map(a -> new HistoryDto(
                        a.getId(), a.getType(), a.getLabel(), a.getLotIdentifier(), a.getStatut(),
                        a.getVp(), a.getVpCible(), a.getCreatedAt().toString(),
                        a.getUserEmail()
                ))
                .toList();

        return ResponseEntity.ok(dtos);
    }

    // ── Récupérer une analyse par ID ─────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<AnalysisHistory> getAnalysis(@PathVariable Long id) {
        return historyRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Supprimer une analyse ────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnalysis(@PathVariable Long id) {
        String email = getCurrentUserEmail();
        return historyRepository.findById(id)
                .filter(a -> a.getUserEmail() != null && a.getUserEmail().equals(email))
                .map(a -> {
                    historyRepository.delete(a);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private String getCurrentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof User user) {
            return user.getEmail();
        }
        return null;
    }

    // ── DTOs ──────────────────────────────────────────────────────────────

    public record SaveAnalysisRequest(
            String type, String label, String lotIdentifier, String statut,
            Double vp, Double vpCible,
            String parametres, String courbe, String resultJson
    ) {}

    public record HistoryDto(
            Long id, String type, String label, String lotIdentifier, String statut,
            Double vp, Double vpCible, String date, String userEmail
    ) {}
}
