package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

    @GetMapping
    public List<Map<String, Object>> getAllCuves() {
        List<Cuve> cuves = cuveRepository.findByDeletedFalseOrderByNomAsc();
        return cuves.stream().map(this::cuveToDto).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getCuveById(@PathVariable Long id) {
        return cuveRepository.findById(id)
                .filter(c -> !c.getDeleted())
                .map(c -> ResponseEntity.ok(cuveToDto(c)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createCuve(@RequestBody CreateCuveRequest request) {
        Cuve cuve = Cuve.builder()
                .nom(request.nom())
                .volumeMax(request.volumeMax())
                .statutPhysique(request.statutPhysique() != null ? request.statutPhysique() : "PROPRE")
                .build();
        Cuve saved = cuveRepository.save(cuve);
        return ResponseEntity.ok(cuveToDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateCuve(@PathVariable Long id, @RequestBody UpdateCuveRequest request) {
        return cuveRepository.findById(id)
                .filter(c -> !c.getDeleted())
                .map(cuve -> {
                    if (request.nom() != null) cuve.setNom(request.nom());
                    if (request.volumeMax() != null) cuve.setVolumeMax(request.volumeMax());
                    if (request.statutPhysique() != null) cuve.setStatutPhysique(request.statutPhysique());
                    return ResponseEntity.ok(cuveToDto(cuveRepository.save(cuve)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCuve(@PathVariable Long id) {
        return cuveRepository.findById(id)
                .filter(c -> !c.getDeleted())
                .map(cuve -> {
                    cuve.setDeleted(true);
                    cuve.setDeletedAt(LocalDateTime.now());
                    cuveRepository.save(cuve);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Map<String, Object>> restoreCuve(@PathVariable Long id) {
        return cuveRepository.findById(id)
                .filter(Cuve::getDeleted)
                .map(cuve -> {
                    cuve.setDeleted(false);
                    cuve.setDeletedAt(null);
                    return ResponseEntity.ok(cuveToDto(cuveRepository.save(cuve)));
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

    public record CreateCuveRequest(String nom, Double volumeMax, String statutPhysique) {}
    public record UpdateCuveRequest(String nom, Double volumeMax, String statutPhysique) {}
}
