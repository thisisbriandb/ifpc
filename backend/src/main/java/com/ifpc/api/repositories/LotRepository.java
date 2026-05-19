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
    List<Lot> findAllByOrderByCreatedAtDesc();
}
