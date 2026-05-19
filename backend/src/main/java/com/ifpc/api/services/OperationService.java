package com.ifpc.api.services;

import com.ifpc.api.models.*;
import com.ifpc.api.repositories.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OperationService {

    private final CuveRepository cuveRepository;
    private final LotRepository lotRepository;
    private final StockageRepository stockageRepository;
    private final OperationRepository operationRepository;

    // ── NETTOYAGE ────────────────────────────────────────────────────────────
    // La cuve passe de SALE → PROPRE
    @Transactional
    public Operation nettoyage(Long cuveId, String userEmail) {
        Cuve cuve = cuveRepository.findById(cuveId)
                .filter(c -> !c.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Cuve introuvable"));

        if (!"SALE".equals(cuve.getStatutPhysique()) && !"EN_NETTOYAGE".equals(cuve.getStatutPhysique())) {
            throw new IllegalStateException("La cuve doit être SALE ou EN_NETTOYAGE pour être nettoyée");
        }

        cuve.setStatutPhysique("PROPRE");
        cuveRepository.save(cuve);

        Operation op = Operation.builder()
                .type("NETTOYAGE")
                .cuveDest(cuve)
                .description("Nettoyage de la cuve " + cuve.getNom())
                .userEmail(userEmail)
                .build();
        return operationRepository.save(op);
    }

    // ── REMPLISSAGE ──────────────────────────────────────────────────────────
    // On affecte un lot à une cuve (la cuve doit être PROPRE et avoir du volume disponible)
    @Transactional
    public Operation remplissage(Long cuveId, Long lotId, Double volume, String userEmail) {
        Cuve cuve = cuveRepository.findById(cuveId)
                .filter(c -> !c.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Cuve introuvable"));

        if (!"PROPRE".equals(cuve.getStatutPhysique())) {
            throw new IllegalStateException("La cuve doit être PROPRE pour recevoir un lot");
        }

        Lot lot = lotRepository.findById(lotId)
                .orElseThrow(() -> new IllegalArgumentException("Lot introuvable"));

        // Check available volume in cuve
        List<Stockage> existing = stockageRepository.findByCuveIdAndDateFinIsNull(cuveId);
        double volumeOccupe = existing.stream().mapToDouble(Stockage::getVolumeOccupe).sum();
        double volumeDisponible = cuve.getVolumeMax() - volumeOccupe;

        double volumeToUse = volume != null ? volume : lot.getVolumeActuel();
        if (volumeToUse > volumeDisponible) {
            throw new IllegalStateException("Volume insuffisant dans la cuve (disponible: " + volumeDisponible + " L)");
        }
        if (volumeToUse > lot.getVolumeActuel()) {
            throw new IllegalStateException("Le lot ne contient que " + lot.getVolumeActuel() + " L");
        }

        // Create stockage
        Stockage stockage = Stockage.builder()
                .cuve(cuve)
                .lot(lot)
                .volumeOccupe(volumeToUse)
                .build();
        stockageRepository.save(stockage);

        Operation op = Operation.builder()
                .type("REMPLISSAGE")
                .cuveDest(cuve)
                .lot(lot)
                .volume(volumeToUse)
                .description("Remplissage de " + cuve.getNom() + " avec " + volumeToUse + "L de " + lot.getIdentifiant())
                .userEmail(userEmail)
                .build();
        return operationRepository.save(op);
    }

    // ── TRANSFERT ────────────────────────────────────────────────────────────
    // Le lot quitte la Cuve A → entre dans la Cuve B
    // Cuve A → SALE, Cuve B reçoit le lot
    @Transactional
    public Operation transfert(Long cuveSourceId, Long cuveDestId, Long lotId, Double volume, String userEmail) {
        Cuve cuveSource = cuveRepository.findById(cuveSourceId)
                .filter(c -> !c.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Cuve source introuvable"));

        Cuve cuveDest = cuveRepository.findById(cuveDestId)
                .filter(c -> !c.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Cuve destination introuvable"));

        if (!"PROPRE".equals(cuveDest.getStatutPhysique())) {
            throw new IllegalStateException("La cuve destination doit être PROPRE");
        }

        Lot lot = lotRepository.findById(lotId)
                .orElseThrow(() -> new IllegalArgumentException("Lot introuvable"));

        // Find active stockage for this lot in source cuve
        List<Stockage> sourceStockages = stockageRepository.findByCuveIdAndDateFinIsNull(cuveSourceId);
        Stockage sourceStockage = sourceStockages.stream()
                .filter(s -> s.getLot().getId().equals(lotId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Le lot n'est pas dans la cuve source"));

        double volumeToTransfer = volume != null ? volume : sourceStockage.getVolumeOccupe();
        if (volumeToTransfer > sourceStockage.getVolumeOccupe()) {
            throw new IllegalStateException("Volume demandé supérieur au volume dans la cuve source");
        }

        // Check dest capacity
        List<Stockage> destStockages = stockageRepository.findByCuveIdAndDateFinIsNull(cuveDestId);
        double destOccupe = destStockages.stream().mapToDouble(Stockage::getVolumeOccupe).sum();
        double destDisponible = cuveDest.getVolumeMax() - destOccupe;
        if (volumeToTransfer > destDisponible) {
            throw new IllegalStateException("Volume insuffisant dans la cuve destination (disponible: " + destDisponible + " L)");
        }

        // Close source stockage (or reduce volume)
        if (volumeToTransfer >= sourceStockage.getVolumeOccupe()) {
            sourceStockage.setDateFin(LocalDateTime.now());
            stockageRepository.save(sourceStockage);
            // If cuve source is now empty, mark as SALE
            List<Stockage> remaining = stockageRepository.findByCuveIdAndDateFinIsNull(cuveSourceId);
            if (remaining.isEmpty()) {
                cuveSource.setStatutPhysique("SALE");
                cuveRepository.save(cuveSource);
            }
        } else {
            sourceStockage.setVolumeOccupe(sourceStockage.getVolumeOccupe() - volumeToTransfer);
            stockageRepository.save(sourceStockage);
        }

        // Create new stockage in dest
        Stockage destStockage = Stockage.builder()
                .cuve(cuveDest)
                .lot(lot)
                .volumeOccupe(volumeToTransfer)
                .build();
        stockageRepository.save(destStockage);

        Operation op = Operation.builder()
                .type("TRANSFERT")
                .cuveSource(cuveSource)
                .cuveDest(cuveDest)
                .lot(lot)
                .volume(volumeToTransfer)
                .description("Transfert de " + volumeToTransfer + "L de " + lot.getIdentifiant() + " : " + cuveSource.getNom() + " → " + cuveDest.getNom())
                .userEmail(userEmail)
                .build();
        return operationRepository.save(op);
    }

    // ── TRANSFORMATION ───────────────────────────────────────────────────────
    // Le lot change de propriétés (spectre, couleur) — ex: filtration, centrifugation
    @Transactional
    public Operation transformation(Long lotId, Double newColorL, Double newColorA, Double newColorB,
                                     String newColorHex, String newSpectrumJson, String description, String userEmail) {
        Lot lot = lotRepository.findById(lotId)
                .orElseThrow(() -> new IllegalArgumentException("Lot introuvable"));

        if (newColorL != null) lot.setColorL(newColorL);
        if (newColorA != null) lot.setColorA(newColorA);
        if (newColorB != null) lot.setColorB(newColorB);
        if (newColorHex != null) lot.setColorHex(newColorHex);
        if (newSpectrumJson != null) lot.setSpectrumJson(newSpectrumJson);
        lotRepository.save(lot);

        // Find current cuve for context
        List<Stockage> stockages = stockageRepository.findByLotIdAndDateFinIsNull(lotId);
        Cuve cuveActuelle = stockages.isEmpty() ? null : stockages.get(0).getCuve();

        Operation op = Operation.builder()
                .type("TRANSFORMATION")
                .cuveSource(cuveActuelle)
                .lot(lot)
                .description(description != null ? description : "Transformation du lot " + lot.getIdentifiant())
                .userEmail(userEmail)
                .build();
        return operationRepository.save(op);
    }

    // ── ASSEMBLAGE ───────────────────────────────────────────────────────────
    // Mélange de lots → création d'un nouveau lot
    @Transactional
    public Operation assemblage(List<AssemblageSource> sources, Long cuveDestId,
                                 String newLotIdentifiant, String typeProduit,
                                 Double colorL, Double colorA, Double colorB, String colorHex,
                                 String spectrumJson, String userEmail) {

        Cuve cuveDest = cuveRepository.findById(cuveDestId)
                .filter(c -> !c.getDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Cuve destination introuvable"));

        if (!"PROPRE".equals(cuveDest.getStatutPhysique())) {
            // If dest cuve already has content, it's OK for assemblage (mixing into existing)
            List<Stockage> destStockages = stockageRepository.findByCuveIdAndDateFinIsNull(cuveDestId);
            if (destStockages.isEmpty() && !"PROPRE".equals(cuveDest.getStatutPhysique())) {
                throw new IllegalStateException("La cuve destination doit être PROPRE ou contenir déjà un lot");
            }
        }

        double totalVolume = 0;

        // Withdraw volumes from source cuves
        for (AssemblageSource src : sources) {
            Lot srcLot = lotRepository.findById(src.lotId())
                    .orElseThrow(() -> new IllegalArgumentException("Lot source introuvable: " + src.lotId()));

            List<Stockage> srcStockages = stockageRepository.findByLotIdAndDateFinIsNull(src.lotId());
            Stockage srcStockage = srcStockages.stream()
                    .filter(s -> s.getCuve().getId().equals(src.cuveId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Le lot " + srcLot.getIdentifiant() + " n'est pas dans la cuve spécifiée"));

            if (src.volume() > srcStockage.getVolumeOccupe()) {
                throw new IllegalStateException("Volume insuffisant pour le lot " + srcLot.getIdentifiant());
            }

            // Reduce or close source stockage
            if (src.volume() >= srcStockage.getVolumeOccupe()) {
                srcStockage.setDateFin(LocalDateTime.now());
                stockageRepository.save(srcStockage);
                // Mark source cuve as SALE if empty
                List<Stockage> remaining = stockageRepository.findByCuveIdAndDateFinIsNull(src.cuveId());
                if (remaining.isEmpty()) {
                    Cuve srcCuve = srcStockage.getCuve();
                    srcCuve.setStatutPhysique("SALE");
                    cuveRepository.save(srcCuve);
                }
            } else {
                srcStockage.setVolumeOccupe(srcStockage.getVolumeOccupe() - src.volume());
                stockageRepository.save(srcStockage);
            }

            // Update source lot volume
            srcLot.setVolumeActuel(srcLot.getVolumeActuel() - src.volume());
            lotRepository.save(srcLot);

            totalVolume += src.volume();
        }

        // Check dest capacity
        List<Stockage> destExisting = stockageRepository.findByCuveIdAndDateFinIsNull(cuveDestId);
        double destOccupe = destExisting.stream().mapToDouble(Stockage::getVolumeOccupe).sum();
        if (totalVolume > cuveDest.getVolumeMax() - destOccupe) {
            throw new IllegalStateException("Capacité insuffisante dans la cuve destination");
        }

        // Create new lot (result of assemblage)
        Lot newLot = Lot.builder()
                .identifiant(newLotIdentifiant)
                .typeProduit(typeProduit)
                .volumeActuel(totalVolume)
                .colorL(colorL)
                .colorA(colorA)
                .colorB(colorB)
                .colorHex(colorHex)
                .spectrumJson(spectrumJson)
                .statutLot("PRET_A_ASSEMBLER")
                .build();
        Lot savedLot = lotRepository.save(newLot);

        // Create stockage in destination
        Stockage destStockage = Stockage.builder()
                .cuve(cuveDest)
                .lot(savedLot)
                .volumeOccupe(totalVolume)
                .build();
        stockageRepository.save(destStockage);

        Operation op = Operation.builder()
                .type("ASSEMBLAGE")
                .cuveDest(cuveDest)
                .lotResultat(savedLot)
                .volume(totalVolume)
                .description("Assemblage de " + sources.size() + " lots → " + newLotIdentifiant + " (" + totalVolume + " L)")
                .userEmail(userEmail)
                .build();
        return operationRepository.save(op);
    }

    // ── DTO for assemblage source ────────────────────────────────────────────
    public record AssemblageSource(Long cuveId, Long lotId, Double volume) {}
}
