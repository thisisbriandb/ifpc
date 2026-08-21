package com.ifpc.api.repositories;

import com.ifpc.api.models.Cuve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Toutes les lectures métier sont cloisonnées par propriétaire (owner_email) :
 * un utilisateur ne voit que ses propres cuves.
 */
@Repository
public interface CuveRepository extends JpaRepository<Cuve, Long> {
    List<Cuve> findByOwnerEmailAndDeletedFalseOrderByNomAsc(String ownerEmail);
    List<Cuve> findByOwnerEmailAndDeletedTrueOrderByDeletedAtDesc(String ownerEmail);
    Optional<Cuve> findByIdAndOwnerEmail(Long id, String ownerEmail);
    List<Cuve> findByIdInAndOwnerEmail(List<Long> ids, String ownerEmail);
}
