package com.ifpc.api.repositories;

import com.ifpc.api.models.Cuve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CuveRepository extends JpaRepository<Cuve, Long> {
    List<Cuve> findByDeletedFalseOrderByNomAsc();
    List<Cuve> findByDeletedFalseAndStatutPhysique(String statutPhysique);
    List<Cuve> findByDeletedTrueOrderByDeletedAtDesc();
}
