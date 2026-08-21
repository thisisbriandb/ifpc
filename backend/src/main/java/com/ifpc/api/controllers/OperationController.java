package com.ifpc.api.controllers;

import com.ifpc.api.models.Operation;
import com.ifpc.api.repositories.OperationRepository;
import com.ifpc.api.security.Tenant;
import com.ifpc.api.services.OperationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Journal des opérations, cloisonné par locataire : on ne voit que les
 * opérations menées sur son propre chai.
 */
@RestController
@RequestMapping("/api/operations")
@RequiredArgsConstructor
public class OperationController {

    private final OperationRepository operationRepository;
    private final OperationService operationService;

    @GetMapping
    public List<Map<String, Object>> getRecentOperations() {
        return operationRepository.findTop50ByUserEmailOrderByCreatedAtDesc(Tenant.requireCurrentEmail())
                .stream().map(this::operationToDto).toList();
    }

    @GetMapping("/cuve/{cuveId}")
    public List<Map<String, Object>> getOperationsByCuve(@PathVariable Long cuveId) {
        return operationRepository.findByUserEmailAndCuve(Tenant.requireCurrentEmail(), cuveId)
                .stream().map(this::operationToDto).toList();
    }

    @GetMapping("/lot/{lotId}")
    public List<Map<String, Object>> getOperationsByLot(@PathVariable Long lotId) {
        return operationRepository.findByUserEmailAndLotIdOrderByCreatedAtDesc(Tenant.requireCurrentEmail(), lotId)
                .stream().map(this::operationToDto).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getOperationById(@PathVariable Long id) {
        return operationRepository.findByIdAndUserEmail(id, Tenant.requireCurrentEmail())
                .map(o -> ResponseEntity.ok(operationToDto(o)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Action endpoints ───────────────────────────────────────────────────

    @PostMapping("/nettoyage")
    public ResponseEntity<?> nettoyage(@RequestBody NettoyageRequest req) {
        String owner = Tenant.requireCurrentEmail();
        try {
            Operation op = operationService.nettoyage(req.cuveId(), owner);
            return ResponseEntity.ok(operationToDto(op));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/remplissage")
    public ResponseEntity<?> remplissage(@RequestBody RemplissageRequest req) {
        String owner = Tenant.requireCurrentEmail();
        try {
            Operation op = operationService.remplissage(req.cuveId(), req.lotId(), req.volume(), owner);
            return ResponseEntity.ok(operationToDto(op));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/transfert")
    public ResponseEntity<?> transfert(@RequestBody TransfertRequest req) {
        String owner = Tenant.requireCurrentEmail();
        try {
            Operation op = operationService.transfert(req.cuveSourceId(), req.cuveDestId(), req.lotId(), req.volume(), owner);
            return ResponseEntity.ok(operationToDto(op));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/transformation")
    public ResponseEntity<?> transformation(@RequestBody TransformationRequest req) {
        String owner = Tenant.requireCurrentEmail();
        try {
            Operation op = operationService.transformation(req.lotId(), req.colorL(), req.colorA(), req.colorB(),
                    req.colorHex(), req.spectrumJson(), req.description(), owner);
            return ResponseEntity.ok(operationToDto(op));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/assemblage")
    public ResponseEntity<?> assemblage(@RequestBody AssemblageRequest req) {
        String owner = Tenant.requireCurrentEmail();
        try {
            List<OperationService.AssemblageSource> sources = req.sources().stream()
                    .map(s -> new OperationService.AssemblageSource(s.cuveId(), s.lotId(), s.volume()))
                    .toList();
            Operation op = operationService.assemblage(sources, req.cuveDestId(),
                    req.newLotIdentifiant(), req.typeProduit(),
                    req.colorL(), req.colorA(), req.colorB(), req.colorHex(),
                    req.spectrumJson(), owner);
            return ResponseEntity.ok(operationToDto(op));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Request DTOs ────────────────────────────────────────────────────────

    public record NettoyageRequest(Long cuveId) {}
    public record RemplissageRequest(Long cuveId, Long lotId, Double volume) {}
    public record TransfertRequest(Long cuveSourceId, Long cuveDestId, Long lotId, Double volume) {}
    public record TransformationRequest(Long lotId, Double colorL, Double colorA, Double colorB,
                                         String colorHex, String spectrumJson, String description) {}
    public record AssemblageSourceDto(Long cuveId, Long lotId, Double volume) {}
    public record AssemblageRequest(List<AssemblageSourceDto> sources, Long cuveDestId,
                                     String newLotIdentifiant, String typeProduit,
                                     Double colorL, Double colorA, Double colorB,
                                     String colorHex, String spectrumJson) {}

    // ── DTO ─────────────────────────────────────────────────────────────────

    private Map<String, Object> operationToDto(Operation op) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", op.getId());
        dto.put("type", op.getType());
        dto.put("cuveSourceId", op.getCuveSource() != null ? op.getCuveSource().getId() : null);
        dto.put("cuveSourceNom", op.getCuveSource() != null ? op.getCuveSource().getNom() : null);
        dto.put("cuveDestId", op.getCuveDest() != null ? op.getCuveDest().getId() : null);
        dto.put("cuveDestNom", op.getCuveDest() != null ? op.getCuveDest().getNom() : null);
        dto.put("lotId", op.getLot() != null ? op.getLot().getId() : null);
        dto.put("lotIdentifiant", op.getLot() != null ? op.getLot().getIdentifiant() : null);
        dto.put("lotResultatId", op.getLotResultat() != null ? op.getLotResultat().getId() : null);
        dto.put("lotResultatIdentifiant", op.getLotResultat() != null ? op.getLotResultat().getIdentifiant() : null);
        dto.put("volume", op.getVolume());
        dto.put("description", op.getDescription());
        dto.put("userEmail", op.getUserEmail());
        dto.put("createdAt", op.getCreatedAt() != null ? op.getCreatedAt().toString() : null);
        return dto;
    }
}
