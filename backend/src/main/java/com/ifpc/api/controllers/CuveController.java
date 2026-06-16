package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import com.ifpc.api.services.OperationService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cuves")
@RequiredArgsConstructor
public class CuveController {

    private final CuveRepository cuveRepository;
    private final StockageRepository stockageRepository;
    private final OperationService operationService;

    @GetMapping("/deleted")
    public ResponseEntity<?> getDeletedCuves() {
        try {
            List<Cuve> cuves = cuveRepository.findByUserIdAndDeletedTrueOrderByDeletedAtDesc(getCurrentUserId());
            return ResponseEntity.ok(cuves.stream().map(this::cuveToDto).toList());
        } catch (Throwable error) {
            Map<String, Object> body = new HashMap<>();
            body.put("error", "Unable to load deleted cuves");
            body.put("errorMessage", error.getMessage());
            return ResponseEntity.internalServerError().body(body);
        }
    }

    @GetMapping
    public ResponseEntity<?> getAllCuves() {
        try {
            List<Cuve> cuves = cuveRepository.findByUserIdAndDeletedFalseOrderByNomAsc(getCurrentUserId());
            return ResponseEntity.ok(cuves.stream().map(this::cuveToDto).toList());
        } catch (Throwable error) {
            Map<String, Object> body = new HashMap<>();
            body.put("error", "Unable to load cuves");
            body.put("errorClass", error.getClass().getName());
            body.put("errorMessage", error.getMessage());
            Throwable cause = error.getCause();
            if (cause != null) {
                body.put("causeClass", cause.getClass().getName());
                body.put("causeMessage", cause.getMessage());
            }
            return ResponseEntity.internalServerError().body(body);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getCuveById(@PathVariable Long id) {
        return cuveRepository.findByIdAndUserId(id, getCurrentUserId())
                .filter(c -> !c.getDeleted())
                .map(c -> ResponseEntity.ok(cuveToDto(c)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createCuve(@RequestBody CreateCuveRequest request, HttpServletResponse response) {
        response.setHeader("X-IFPC-Cuve-Controller", "create");
        try {
            Cuve cuve = Cuve.builder()
                    .nom(request.nom())
                    .volumeMax(request.volumeMax())
                    .statutPhysique(request.statutPhysique() != null ? request.statutPhysique() : "PROPRE")
                    .userId(getCurrentUserId())
                    .build();
            Cuve saved = cuveRepository.save(cuve);
            return ResponseEntity.ok(cuveToDto(saved));
        } catch (Throwable error) {
            Map<String, Object> body = new HashMap<>();
            body.put("error", "Unable to create cuve");
            body.put("errorClass", error.getClass().getName());
            body.put("errorMessage", error.getMessage());
            Throwable cause = error.getCause();
            if (cause != null) {
                body.put("causeClass", cause.getClass().getName());
                body.put("causeMessage", cause.getMessage());
            }
            return ResponseEntity.internalServerError().body(body);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateCuve(@PathVariable Long id, @RequestBody UpdateCuveRequest request) {
        return cuveRepository.findByIdAndUserId(id, getCurrentUserId())
                .filter(c -> !c.getDeleted())
                .map(cuve -> {
                    if (request.nom() != null) cuve.setNom(request.nom());
                    if (request.volumeMax() != null) cuve.setVolumeMax(request.volumeMax());
                    if (request.statutPhysique() != null) cuve.setStatutPhysique(request.statutPhysique());
                    if (request.planX() != null) cuve.setPlanX(request.planX());
                    if (request.planY() != null) cuve.setPlanY(request.planY());
                    return ResponseEntity.ok(cuveToDto(cuveRepository.save(cuve)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/layout")
    public ResponseEntity<?> updateCuvesLayout(@RequestBody List<LayoutItemRequest> request) {
        try {
            Long userId = getCurrentUserId();
            for (LayoutItemRequest item : request) {
                if (item.id() != null) {
                    cuveRepository.findByIdAndUserId(item.id(), userId)
                            .ifPresent(cuve -> {
                                cuve.setPlanX(item.planX());
                                cuve.setPlanY(item.planY());
                                cuveRepository.save(cuve);
                            });
                }
            }
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Throwable error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Unable to update layout",
                    "errorMessage", error.getMessage()
            ));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCuve(@PathVariable Long id) {
        return cuveRepository.findByIdAndUserId(id, getCurrentUserId())
                .filter(c -> !c.getDeleted())
                .map(cuve -> {
                    cuve.setDeleted(true);
                    cuve.setDeletedAt(LocalDateTime.now());
                    cuveRepository.save(cuve);
                    try {
                        operationService.logCuveDeletion(cuve.getId(), getCurrentUserEmail());
                    } catch (Exception e) {
                        // ignore or log
                    }
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Map<String, Object>> restoreCuve(@PathVariable Long id) {
        return cuveRepository.findByIdAndUserId(id, getCurrentUserId())
                .filter(Cuve::getDeleted)
                .map(cuve -> {
                    cuve.setDeleted(false);
                    cuve.setDeletedAt(null);
                    Cuve saved = cuveRepository.save(cuve);
                    try {
                        operationService.logCuveRestoration(saved.getId(), getCurrentUserEmail());
                    } catch (Exception e) {
                        // ignore or log
                    }
                    return ResponseEntity.ok(cuveToDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof User user) {
            return user.getId();
        }
        return null;
    }

    private String getCurrentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof User user) {
            return user.getEmail();
        }
        return null;
    }

    // ── DTO mapping ─────────────────────────────────────────────────────────

    private Map<String, Object> cuveToDto(Cuve cuve) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", cuve.getId());
        dto.put("nom", cuve.getNom());
        dto.put("volumeMax", cuve.getVolumeMax());
        dto.put("statutPhysique", cuve.getStatutPhysique());
        dto.put("planX", cuve.getPlanX());
        dto.put("planY", cuve.getPlanY());
        dto.put("userId", cuve.getUserId());
        dto.put("createdAt", cuve.getCreatedAt() != null ? cuve.getCreatedAt().toString() : null);
        dto.put("updatedAt", cuve.getUpdatedAt() != null ? cuve.getUpdatedAt().toString() : null);

        // Include active stockages (lots currently in this cuve)
        List<Stockage> stockages = stockageRepository.findByCuveIdAndDateFinIsNull(cuve.getId());
        double volumeOccupe = stockages.stream().mapToDouble(Stockage::getVolumeOccupe).sum();
        dto.put("volumeOccupe", volumeOccupe);
        dto.put("volumeDisponible", cuve.getVolumeMax() - volumeOccupe);
        dto.put("stockages", stockages.stream().map(s -> {
            Map<String, Object> sDto = new HashMap<>();
            sDto.put("id", s.getId());
            sDto.put("lotId", s.getLot().getId());
            sDto.put("lotIdentifiant", s.getLot().getIdentifiant());
            sDto.put("lotTypeProduit", s.getLot().getTypeProduit());
            sDto.put("lotColorHex", s.getLot().getColorHex());
            sDto.put("volumeOccupe", s.getVolumeOccupe());
            sDto.put("dateDebut", s.getDateDebut().toString());
            return sDto;
        }).toList());

        return dto;
    }

    // ── Request records ─────────────────────────────────────────────────────

    public record CreateCuveRequest(String nom, Double volumeMax, String statutPhysique, Integer planX, Integer planY) {}
    public record UpdateCuveRequest(String nom, Double volumeMax, String statutPhysique, Integer planX, Integer planY) {}
    public record LayoutItemRequest(Long id, Integer planX, Integer planY) {}
}
