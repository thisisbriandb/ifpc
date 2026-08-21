package com.ifpc.api.repositories;

import com.ifpc.api.models.Lot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Toutes les lectures métier sont cloisonnées par propriétaire (owner_email) :
 * un utilisateur ne voit que ses propres lots.
 */
@Repository
public interface LotRepository extends JpaRepository<Lot, Long> {
    List<Lot> findByOwnerEmailAndDeletedFalseOrderByCreatedAtDesc(String ownerEmail);
    List<Lot> findByOwnerEmailAndDeletedTrueOrderByDeletedAtDesc(String ownerEmail);
    Optional<Lot> findByIdAndOwnerEmail(Long id, String ownerEmail);
    Optional<Lot> findByOwnerEmailAndIdentifiantAndDeletedFalse(String ownerEmail, String identifiant);
}
