package com.ifpc.api.controllers;

import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.repositories.LotRepository;
import com.ifpc.api.repositories.StockageRepository;
import com.ifpc.api.security.Tenant;
import com.ifpc.api.services.OperationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Les lots sont cloisonnés par locataire : chaque requête est filtrée sur le
 * propriétaire courant, et une ressource appartenant à un autre utilisateur
 * répond 404 (jamais 403, pour ne pas révéler son existence).
 */
@RestController
@RequestMapping("/api/lots")
@RequiredArgsConstructor
public class LotController {

    private final LotRepository lotRepository;
    private final StockageRepository stockageRepository;
    private final OperationService operationService;

    @GetMapping
    public List<Map<String, Object>> getAllLots() {
        return lotRepository.findByOwnerEmailAndDeletedFalseOrderByCreatedAtDesc(Tenant.requireCurrentEmail())
                .stream().map(this::lotToDto).toList();
    }

    @GetMapping("/deleted")
    public List<Map<String, Object>> getDeletedLots() {
        return lotRepository.findByOwnerEmailAndDeletedTrueOrderByDeletedAtDesc(Tenant.requireCurrentEmail())
                .stream().map(this::lotToDto).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getLotById(@PathVariable Long id) {
        return lotRepository.findByIdAndOwnerEmail(id, Tenant.requireCurrentEmail())
                .filter(l -> !l.getDeleted())
                .map(l -> ResponseEntity.ok(lotToDto(l)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createLot(@RequestBody CreateLotRequest request) {
        String owner = Tenant.requireCurrentEmail();

        // L'identifiant n'est unique qu'au sein d'un locataire
        if (request.identifiant() != null
                && lotRepository.findByOwnerEmailAndIdentifiantAndDeletedFalse(owner, request.identifiant()).isPresent()) {
            return ResponseEntity.status(409).body(Map.<String, Object>of("error", "Un lot porte déjà cet identifiant"));
        }

        Lot lot = Lot.builder()
                .identifiant(request.identifiant())
                .ownerEmail(owner)
                .typeProduit(request.typeProduit())
                .volumeActuel(request.volumeActuel() != null ? request.volumeActuel() : 0.0)
                .colorL(request.colorL())
                .colorA(request.colorA())
                .colorB(request.colorB())
                .colorHex(request.colorHex())
                .spectrumJson(request.spectrumJson())
                .statutLot(request.statutLot() != null ? request.statutLot() : "EN_FERMENTATION")
                .build();
        Lot saved = lotRepository.save(lot);
        return ResponseEntity.ok(lotToDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateLot(@PathVariable Long id, @RequestBody UpdateLotRequest request) {
        String owner = Tenant.requireCurrentEmail();

        boolean identifiantPris = request.identifiant() != null
                && lotRepository.findByOwnerEmailAndIdentifiantAndDeletedFalse(owner, request.identifiant())
                        .filter(other -> !other.getId().equals(id))
                        .isPresent();
        if (identifiantPris) {
            return ResponseEntity.status(409).body(Map.<String, Object>of("error", "Un lot porte déjà cet identifiant"));
        }

        return lotRepository.findByIdAndOwnerEmail(id, owner)
                .filter(l -> !l.getDeleted())
                .map(lot -> {
                    if (request.identifiant() != null) lot.setIdentifiant(request.identifiant());
                    if (request.typeProduit() != null) lot.setTypeProduit(request.typeProduit());
                    if (request.volumeActuel() != null) lot.setVolumeActuel(request.volumeActuel());
                    if (request.colorL() != null) lot.setColorL(request.colorL());
                    if (request.colorA() != null) lot.setColorA(request.colorA());
                    if (request.colorB() != null) lot.setColorB(request.colorB());
                    if (request.colorHex() != null) lot.setColorHex(request.colorHex());
                    if (request.spectrumJson() != null) lot.setSpectrumJson(request.spectrumJson());
                    if (request.statutLot() != null) lot.setStatutLot(request.statutLot());
                    return ResponseEntity.ok(lotToDto(lotRepository.save(lot)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLot(@PathVariable Long id) {
        String owner = Tenant.requireCurrentEmail();
        return lotRepository.findByIdAndOwnerEmail(id, owner)
                .filter(l -> !l.getDeleted())
                .map(lot -> {
                    lot.setDeleted(true);
                    lot.setDeletedAt(LocalDateTime.now());
                    lotRepository.save(lot);
                    try {
                        operationService.logLotDeletion(lot.getId(), owner);
                    } catch (Exception e) {
                        // ignore or log
                    }
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Map<String, Object>> restoreLot(@PathVariable Long id) {
        String owner = Tenant.requireCurrentEmail();
        return lotRepository.findByIdAndOwnerEmail(id, owner)
                .filter(Lot::getDeleted)
                .map(lot -> {
                    lot.setDeleted(false);
                    lot.setDeletedAt(null);
                    Lot saved = lotRepository.save(lot);
                    try {
                        operationService.logLotRestoration(saved.getId(), owner);
                    } catch (Exception e) {
                        // ignore or log
                    }
                    return ResponseEntity.ok(lotToDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── DTO mapping ─────────────────────────────────────────────────────────

    private Map<String, Object> lotToDto(Lot lot) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", lot.getId());
        dto.put("identifiant", lot.getIdentifiant());
        dto.put("typeProduit", lot.getTypeProduit());
        dto.put("volumeActuel", lot.getVolumeActuel());
        dto.put("colorL", lot.getColorL());
        dto.put("colorA", lot.getColorA());
        dto.put("colorB", lot.getColorB());
        dto.put("colorHex", lot.getColorHex());
        dto.put("spectrumJson", lot.getSpectrumJson());
        dto.put("statutLot", lot.getStatutLot());
        dto.put("createdAt", lot.getCreatedAt() != null ? lot.getCreatedAt().toString() : null);
        dto.put("updatedAt", lot.getUpdatedAt() != null ? lot.getUpdatedAt().toString() : null);

        // Include current location (active stockage). Comme pour les cuves, le
        // volume reste celui réellement logé, mais on ne nomme que les cuves
        // du même propriétaire.
        List<Stockage> stockages = stockageRepository.findByLotIdAndDateFinIsNull(lot.getId());
        double volumeOccupe = stockages.stream().mapToDouble(Stockage::getVolumeOccupe).sum();
        double volumeRestant = Math.max(0.0, lot.getVolumeActuel() - volumeOccupe);
        dto.put("volumeRestant", volumeRestant);
        List<Stockage> chezLeProprietaire = stockages.stream()
                .filter(s -> Tenant.owns(s.getCuve().getOwnerEmail(), lot.getOwnerEmail()))
                .toList();
        dto.put("cuveActuelle", volumeRestant > 0.1 ? null : (chezLeProprietaire.isEmpty() ? null : Map.of(
                "cuveId", chezLeProprietaire.get(0).getCuve().getId(),
                "cuveNom", chezLeProprietaire.get(0).getCuve().getNom(),
                "volumeOccupe", chezLeProprietaire.get(0).getVolumeOccupe()
        )));

        return dto;
    }

    // ── Request records ─────────────────────────────────────────────────────

    public record CreateLotRequest(
            String identifiant, String typeProduit, Double volumeActuel,
            Double colorL, Double colorA, Double colorB, String colorHex,
            String spectrumJson, String statutLot
    ) {}

    public record UpdateLotRequest(
            String identifiant, String typeProduit, Double volumeActuel,
            Double colorL, Double colorA, Double colorB, String colorHex,
            String spectrumJson, String statutLot
    ) {}
}
