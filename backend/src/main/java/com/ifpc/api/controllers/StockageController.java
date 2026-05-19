package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.LotRepository;
import com.ifpc.api.repositories.StockageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stockages")
@RequiredArgsConstructor
public class StockageController {

    private final StockageRepository stockageRepository;
    private final CuveRepository cuveRepository;
    private final LotRepository lotRepository;

    @GetMapping
    public List<Map<String, Object>> getActiveStockages() {
        return stockageRepository.findAll().stream()
                .filter(s -> s.getDateFin() == null)
                .map(this::stockageToDto)
                .toList();
    }

    @GetMapping("/cuve/{cuveId}")
    public List<Map<String, Object>> getStockagesByCuve(@PathVariable Long cuveId) {
        return stockageRepository.findByCuveIdOrderByDateDebutDesc(cuveId)
                .stream().map(this::stockageToDto).toList();
    }

    @GetMapping("/lot/{lotId}")
    public List<Map<String, Object>> getStockagesByLot(@PathVariable Long lotId) {
        return stockageRepository.findByLotIdOrderByDateDebutDesc(lotId)
                .stream().map(this::stockageToDto).toList();
    }

    @PostMapping
    public ResponseEntity<?> createStockage(@RequestBody CreateStockageRequest request) {
        Cuve cuve = cuveRepository.findById(request.cuveId())
                .filter(c -> !c.getDeleted())
                .orElse(null);
        if (cuve == null) return ResponseEntity.badRequest().body(Map.of("error", "Cuve introuvable"));

        Lot lot = lotRepository.findById(request.lotId()).orElse(null);
        if (lot == null) return ResponseEntity.badRequest().body(Map.of("error", "Lot introuvable"));

        // Check available volume
        List<Stockage> existing = stockageRepository.findByCuveIdAndDateFinIsNull(cuve.getId());
        double volumeOccupe = existing.stream().mapToDouble(Stockage::getVolumeOccupe).sum();
        double volumeDisponible = cuve.getVolumeMax() - volumeOccupe;
        if (request.volumeOccupe() > volumeDisponible) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Volume insuffisant dans la cuve",
                    "volumeDisponible", volumeDisponible
            ));
        }

        Stockage stockage = Stockage.builder()
                .cuve(cuve)
                .lot(lot)
                .volumeOccupe(request.volumeOccupe())
                .build();
        Stockage saved = stockageRepository.save(stockage);
        return ResponseEntity.ok(stockageToDto(saved));
    }

    @PostMapping("/{id}/terminer")
    public ResponseEntity<Map<String, Object>> terminerStockage(@PathVariable Long id) {
        return stockageRepository.findById(id)
                .filter(s -> s.getDateFin() == null)
                .map(s -> {
                    s.setDateFin(LocalDateTime.now());
                    return ResponseEntity.ok(stockageToDto(stockageRepository.save(s)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── DTO ─────────────────────────────────────────────────────────────────

    private Map<String, Object> stockageToDto(Stockage s) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", s.getId());
        dto.put("cuveId", s.getCuve().getId());
        dto.put("cuveNom", s.getCuve().getNom());
        dto.put("lotId", s.getLot().getId());
        dto.put("lotIdentifiant", s.getLot().getIdentifiant());
        dto.put("lotTypeProduit", s.getLot().getTypeProduit());
        dto.put("lotColorHex", s.getLot().getColorHex());
        dto.put("volumeOccupe", s.getVolumeOccupe());
        dto.put("dateDebut", s.getDateDebut().toString());
        dto.put("dateFin", s.getDateFin() != null ? s.getDateFin().toString() : null);
        dto.put("actif", s.getDateFin() == null);
        return dto;
    }

    public record CreateStockageRequest(Long cuveId, Long lotId, Double volumeOccupe) {}
}
