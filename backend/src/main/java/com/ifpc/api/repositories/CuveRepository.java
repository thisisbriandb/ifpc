package com.ifpc.api.repositories;

import com.ifpc.api.models.Cuve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import java.util.Optional;

@Repository
public interface CuveRepository extends JpaRepository<Cuve, Long> {
    List<Cuve> findByDeletedFalseOrderByNomAsc();
    List<Cuve> findByDeletedFalseAndStatutPhysique(String statutPhysique);
    List<Cuve> findByDeletedTrueOrderByDeletedAtDesc();

    List<Cuve> findByUserIdAndDeletedFalseOrderByNomAsc(Long userId);
    List<Cuve> findByUserIdAndDeletedFalseAndStatutPhysique(Long userId, String statutPhysique);
    List<Cuve> findByUserIdAndDeletedTrueOrderByDeletedAtDesc(Long userId);
    Optional<Cuve> findByIdAndUserId(Long id, Long userId);
}
