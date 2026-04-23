package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.repositories.CuveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cuves")
@RequiredArgsConstructor
public class CuveController {

    private final CuveRepository cuveRepository;

    @GetMapping
    public List<Cuve> getAllCuves() {
        return cuveRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cuve> getCuveById(@PathVariable Long id) {
        return cuveRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'EXPERT')")
    public Cuve createCuve(@RequestBody Cuve cuve) {
        return cuveRepository.save(cuve);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'EXPERT')")
    public ResponseEntity<Cuve> updateCuve(@PathVariable Long id, @RequestBody Cuve cuveDetails) {
        return cuveRepository.findById(id)
                .map(cuve -> {
                    cuve.setNom(cuveDetails.getNom());
                    cuve.setVolumeMax(cuveDetails.getVolumeMax());
                    cuve.setVolumeActuel(cuveDetails.getVolumeActuel());
                    cuve.setTypeProduit(cuveDetails.getTypeProduit());
                    cuve.setStatut(cuveDetails.getStatut());
                    cuve.setLotIdentifier(cuveDetails.getLotIdentifier());
                    cuve.setColorL(cuveDetails.getColorL());
                    cuve.setColorA(cuveDetails.getColorA());
                    cuve.setColorB(cuveDetails.getColorB());
                    cuve.setColorHex(cuveDetails.getColorHex());
                    cuve.setSpectrumJson(cuveDetails.getSpectrumJson());
                    return ResponseEntity.ok(cuveRepository.save(cuve));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCuve(@PathVariable Long id) {
        return cuveRepository.findById(id)
                .map(cuve -> {
                    cuveRepository.delete(cuve);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
