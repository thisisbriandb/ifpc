package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import com.ifpc.api.security.Tenant;
import com.ifpc.api.services.OperationService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Les cuves sont cloisonnées par locataire : chaque requête est filtrée sur le
 * propriétaire courant, et une cuve appartenant à un autre utilisateur répond
 * 404 (jamais 403, pour ne pas révéler son existence).
 */
@RestController
@RequestMapping("/api/cuves")
@RequiredArgsConstructor
public class CuveController {

    private final CuveRepository cuveRepository;
    private final StockageRepository stockageRepository;
    private final OperationService operationService;

    @GetMapping("/deleted")
    public ResponseEntity<?> getDeletedCuves() {
        String owner = Tenant.requireCurrentEmail();
        try {
            List<Cuve> cuves = cuveRepository.findByOwnerEmailAndDeletedTrueOrderByDeletedAtDesc(owner);
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
        String owner = Tenant.requireCurrentEmail();
        try {
            List<Cuve> cuves = cuveRepository.findByOwnerEmailAndDeletedFalseOrderByNomAsc(owner);
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
        return cuveRepository.findByIdAndOwnerEmail(id, Tenant.requireCurrentEmail())
                .filter(c -> !c.getDeleted())
                .map(c -> ResponseEntity.ok(cuveToDto(c)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createCuve(@RequestBody CreateCuveRequest request, HttpServletResponse response) {
        response.setHeader("X-IFPC-Cuve-Controller", "create");
        String owner = Tenant.requireCurrentEmail();
        try {
            String finalNom = request.nom();
            if (finalNom != null && !finalNom.startsWith("Cuve ")) {
                finalNom = "Cuve " + finalNom;
            }
            Cuve cuve = Cuve.builder()
                    .nom(finalNom)
                    .ownerEmail(owner)
                    .volumeMax(request.volumeMax())
                    .statutPhysique(request.statutPhysique() != null ? request.statutPhysique() : "PROPRE")
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

    @PutMapping("/layout")
    public ResponseEntity<?> updateCuvesLayout(@RequestBody List<UpdateCuveLayoutRequest> request) {
        List<Long> ids = request.stream().map(UpdateCuveLayoutRequest::id).toList();
        List<Cuve> cuves = cuveRepository.findByIdInAndOwnerEmail(ids, Tenant.requireCurrentEmail()).stream()
                .filter(c -> !c.getDeleted())
                .toList();

        if (cuves.size() != ids.size()) {
            Map<String, Object> body = new HashMap<>();
            body.put("error", "Unable to update cuve layout");
            body.put("errorMessage", "One or more cuves were not found");
            return ResponseEntity.status(404).body(body);
        }

        Map<Long, UpdateCuveLayoutRequest> requestsById = new HashMap<>();
        request.forEach(item -> requestsById.put(item.id(), item));
        cuves.forEach(cuve -> {
            UpdateCuveLayoutRequest item = requestsById.get(cuve.getId());
            cuve.setPlanX(item.planX());
            cuve.setPlanY(item.planY());
        });

        List<Map<String, Object>> saved = cuveRepository.saveAll(cuves).stream()
                .map(this::cuveToDto)
                .toList();
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateCuve(@PathVariable Long id, @RequestBody UpdateCuveRequest request) {
        return cuveRepository.findByIdAndOwnerEmail(id, Tenant.requireCurrentEmail())
                .filter(c -> !c.getDeleted())
                .map(cuve -> {
                    if (request.nom() != null) {
                        String finalNom = request.nom();
                        if (!finalNom.startsWith("Cuve ")) {
                            finalNom = "Cuve " + finalNom;
                        }
                        cuve.setNom(finalNom);
                    }
                    if (request.volumeMax() != null) cuve.setVolumeMax(request.volumeMax());
                    if (request.statutPhysique() != null) cuve.setStatutPhysique(request.statutPhysique());
                    return ResponseEntity.ok(cuveToDto(cuveRepository.save(cuve)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCuve(@PathVariable Long id) {
        String owner = Tenant.requireCurrentEmail();
        return cuveRepository.findByIdAndOwnerEmail(id, owner)
                .filter(c -> !c.getDeleted())
                .map(cuve -> {
                    cuve.setDeleted(true);
                    cuve.setDeletedAt(LocalDateTime.now());
                    cuveRepository.save(cuve);
                    try {
                        operationService.logCuveDeletion(cuve.getId(), owner);
                    } catch (Exception e) {
                        // ignore or log
                    }
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Map<String, Object>> restoreCuve(@PathVariable Long id) {
        String owner = Tenant.requireCurrentEmail();
        return cuveRepository.findByIdAndOwnerEmail(id, owner)
                .filter(Cuve::getDeleted)
                .map(cuve -> {
                    cuve.setDeleted(false);
                    cuve.setDeletedAt(null);
                    Cuve saved = cuveRepository.save(cuve);
                    try {
                        operationService.logCuveRestoration(saved.getId(), owner);
                    } catch (Exception e) {
                        // ignore or log
                    }
                    return ResponseEntity.ok(cuveToDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── DTO mapping ─────────────────────────────────────────────────────────

    private Map<String, Object> cuveToDto(Cuve cuve) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", cuve.getId());
        dto.put("nom", cuve.getNom());
        dto.put("volumeMax", cuve.getVolumeMax());
        dto.put("statutPhysique", cuve.getStatutPhysique());
        dto.put("createdAt", cuve.getCreatedAt() != null ? cuve.getCreatedAt().toString() : null);
        dto.put("updatedAt", cuve.getUpdatedAt() != null ? cuve.getUpdatedAt().toString() : null);
        dto.put("planX", cuve.getPlanX());
        dto.put("planY", cuve.getPlanY());

        // Include active stockages (lots currently in this cuve).
        // Les volumes restent calculés sur la totalité du contenu — c'est la
        // réalité physique de la cuve — mais seuls les lots du même
        // propriétaire sont nommés. Le cas d'un lot étranger dans sa cuve ne
        // peut naître que d'une donnée antérieure au cloisonnement.
        List<Stockage> stockages = stockageRepository.findByCuveIdAndDateFinIsNull(cuve.getId());
        double volumeOccupe = stockages.stream().mapToDouble(Stockage::getVolumeOccupe).sum();
        dto.put("volumeOccupe", volumeOccupe);
        dto.put("volumeDisponible", cuve.getVolumeMax() - volumeOccupe);
        dto.put("stockages", stockages.stream()
                .filter(s -> Tenant.owns(s.getLot().getOwnerEmail(), cuve.getOwnerEmail()))
                .map(s -> {
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

    public record CreateCuveRequest(String nom, Double volumeMax, String statutPhysique) {}
    public record UpdateCuveRequest(String nom, Double volumeMax, String statutPhysique) {}
    public record UpdateCuveLayoutRequest(Long id, Double planX, Double planY) {}
}
