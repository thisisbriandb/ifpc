package com.ifpc.api.repositories;

import com.ifpc.api.models.Lot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LotRepository extends JpaRepository<Lot, Long> {
    List<Lot> findByStatutLotOrderByCreatedAtDesc(String statutLot);
    List<Lot> findByTypeProduitOrderByCreatedAtDesc(String typeProduit);
    Optional<Lot> findByIdentifiant(String identifiant);
    Optional<Lot> findByIdentifiantAndDeletedFalse(String identifiant);
    List<Lot> findAllByOrderByCreatedAtDesc();
    List<Lot> findByDeletedFalseOrderByCreatedAtDesc();
    List<Lot> findByDeletedTrueOrderByDeletedAtDesc();

    List<Lot> findByUserIdAndStatutLotOrderByCreatedAtDesc(Long userId, String statutLot);
    List<Lot> findByUserIdAndTypeProduitOrderByCreatedAtDesc(Long userId, String typeProduit);
    Optional<Lot> findByIdentifiantAndUserId(String identifiant, Long userId);
    Optional<Lot> findByIdentifiantAndUserIdAndDeletedFalse(String identifiant, Long userId);
    List<Lot> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Lot> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(Long userId);
    List<Lot> findByUserIdAndDeletedTrueOrderByDeletedAtDesc(Long userId);
    Optional<Lot> findByIdAndUserId(Long id, Long userId);
}
