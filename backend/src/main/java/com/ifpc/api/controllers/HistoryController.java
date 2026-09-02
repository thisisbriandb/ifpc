package com.ifpc.api.controllers;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ifpc.api.models.AnalysisHistory;
import com.ifpc.api.models.AuditAction;
import com.ifpc.api.repositories.AnalysisHistoryRepository;
import com.ifpc.api.services.AuditService;
import com.ifpc.api.security.JwtService;
import com.ifpc.api.security.Tenant;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Historique d'analyses, cloisonné par locataire : une analyse n'est lisible
 * que par l'utilisateur qui l'a lancée.
 */
@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class HistoryController {

    /** Types d'analyse dont le verdict engage la maîtrise sanitaire. */
    private static final String TYPE_CONTROLE = "controle";

    private final AnalysisHistoryRepository historyRepository;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;

    // ── Sauvegarder une analyse ───────────────────────────────────────────
    @PostMapping
    public ResponseEntity<AnalysisHistory> saveAnalysis(@RequestBody SaveAnalysisRequest request) {
        String email = Tenant.requireCurrentEmail();

        AnalysisHistory.AnalysisHistoryBuilder history = AnalysisHistory.builder()
                .label(request.label())
                .lotIdentifier(request.lotIdentifier())
                .courbe(request.courbe())
                .resultJson(request.resultJson())
                .userEmail(email);

        if (TYPE_CONTROLE.equals(request.type())) {
            // Un contrôle de pasteurisation est une pièce de maîtrise sanitaire :
            // son verdict vient du jeton signé par le moteur, jamais du corps de
            // la requête. Sans jeton valide, rien n'est archivé.
            appliquerResultatScelle(history, request.jetonResultat());
        } else {
            // Colorimétrie et autres analyses sans verdict sanitaire : les
            // champs restent déclaratifs, et l'enregistrement le dit.
            history.type(request.type())
                    .statut(request.statut())
                    .vp(request.vp())
                    .vpCible(request.vpCible())
                    .parametres(request.parametres())
                    .scelle(false);
        }

        try {
            return ResponseEntity.ok(historyRepository.save(history.build()));
        } catch (DataIntegrityViolationException e) {
            // Le « jti » est unique : le résultat a déjà été archivé.
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ce résultat de calcul a déjà été enregistré. Relancez l'analyse pour en archiver une nouvelle.");
        }
    }

    /**
     * Reprend le verdict, la VP et les paramètres depuis le jeton du moteur.
     *
     * <p>Rien de ce que le client a écrit dans ces champs n'est retenu : c'est
     * tout l'objet du scellement.</p>
     */
    private void appliquerResultatScelle(AnalysisHistory.AnalysisHistoryBuilder history, String jeton) {
        if (jeton == null || jeton.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Un contrôle de pasteurisation ne peut être enregistré que depuis un résultat du moteur de calcul.");
        }

        Claims claims;
        try {
            claims = jwtService.lireClaims(jeton);
        } catch (JwtException e) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Résultat de calcul non authentifié : il n'a pas été produit par le moteur, ou il a expiré.");
        }

        if (!TYPE_CONTROLE.equals(claims.get("typ_resultat", String.class))) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Ce jeton ne correspond pas à un contrôle de pasteurisation.");
        }

        history.type(TYPE_CONTROLE)
                .statut(claims.get("statut", String.class))
                .vp(nombre(claims.get("vp")))
                .vpCible(nombre(claims.get("vp_cible")))
                .parametres(enJson(claims.get("parametres")))
                .jetonResultat(jeton)
                .resultatJti(claims.getId())
                .scelle(true);
    }

    private static Double nombre(Object valeur) {
        return valeur instanceof Number n ? n.doubleValue() : null;
    }

    private String enJson(Object valeur) {
        if (valeur == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(valeur);
        } catch (JsonProcessingException e) {
            // Les paramètres viennent d'un jeton que nous avons signé : une
            // sérialisation impossible signalerait une anomalie, pas une entrée
            // hostile. L'analyse s'archive sans eux plutôt que d'échouer.
            return null;
        }
    }

    // ── Lister les analyses récentes ──────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<HistoryDto>> getRecentHistory() {
        String email = Tenant.requireCurrentEmail();

        List<AnalysisHistory> analyses = historyRepository.findTop50ByUserEmailAndDeletedFalseOrderByCreatedAtDesc(email);

        List<HistoryDto> dtos = analyses.stream()
                .map(a -> new HistoryDto(
                        a.getId(), a.getType(), a.getLabel(), a.getLotIdentifier(), a.getStatut(),
                        a.getVp(), a.getVpCible(), a.getParametres(), a.getCreatedAt().toString(),
                        a.getUserEmail(), Boolean.TRUE.equals(a.getScelle())
                ))
                .toList();

        return ResponseEntity.ok(dtos);
    }

    // ── Récupérer une analyse par ID ─────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<AnalysisHistory> getAnalysis(@PathVariable Long id) {
        return historyRepository.findByIdAndUserEmailAndDeletedFalse(id, Tenant.requireCurrentEmail())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Retirer une analyse de l'historique ──────────────────────────────
    //
    // La suppression est logique : l'analyse sort de l'historique consultable
    // mais reste au registre, et l'opération est consignée au journal d'audit.
    // Un registre de maîtrise sanitaire dont on peut retirer les résultats
    // gênants ne démontre rien.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnalysis(@PathVariable Long id) {
        String email = Tenant.requireCurrentEmail();
        return historyRepository.findByIdAndUserEmailAndDeletedFalse(id, email)
                .map(analyse -> {
                    analyse.setDeleted(true);
                    analyse.setDeletedAt(LocalDateTime.now());
                    analyse.setDeletedBy(email);
                    historyRepository.save(analyse);

                    auditService.consigner(AuditAction.ANALYSE_SUPPRIMEE, "analyse",
                            String.valueOf(analyse.getId()), Map.of(
                                    "statut", String.valueOf(analyse.getStatut()),
                                    "lot", String.valueOf(analyse.getLotIdentifier()),
                                    "scelle", Boolean.TRUE.equals(analyse.getScelle()),
                                    "creeeLe", String.valueOf(analyse.getCreatedAt())));

                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── DTOs ──────────────────────────────────────────────────────────────

    /**
     * Corps d'une demande d'archivage.
     *
     * <p>Pour un contrôle de pasteurisation, seuls {@code label},
     * {@code lotIdentifier}, {@code courbe}, {@code resultJson} et
     * {@code jetonResultat} sont lus : le verdict, la VP, la cible et les
     * paramètres viennent du jeton.</p>
     */
    public record SaveAnalysisRequest(
            String type, String label, String lotIdentifier, String statut,
            Double vp, Double vpCible,
            String parametres, String courbe, String resultJson,
            String jetonResultat
    ) {}

    public record HistoryDto(
            Long id, String type, String label, String lotIdentifier, String statut,
            Double vp, Double vpCible, String parametres, String date, String userEmail,
            boolean scelle
    ) {}
}
