package com.ifpc.api.repositories;

import com.ifpc.api.models.Stockage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Un stockage appartient au locataire propriétaire de la cuve concernée
 * (cuve et lot appartiennent toujours au même locataire, cf. OperationService).
 */
@Repository
public interface StockageRepository extends JpaRepository<Stockage, Long> {
    List<Stockage> findByCuveIdAndDateFinIsNull(Long cuveId);
    List<Stockage> findByLotIdAndDateFinIsNull(Long lotId);

    List<Stockage> findByCuve_OwnerEmailAndDateFinIsNull(String ownerEmail);
    List<Stockage> findByCuve_IdAndCuve_OwnerEmailOrderByDateDebutDesc(Long cuveId, String ownerEmail);
    List<Stockage> findByLot_IdAndLot_OwnerEmailOrderByDateDebutDesc(Long lotId, String ownerEmail);
    Optional<Stockage> findByIdAndCuve_OwnerEmail(Long id, String ownerEmail);
}
