package com.ifpc.api.repositories;

import com.ifpc.api.models.Stockage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockageRepository extends JpaRepository<Stockage, Long> {
    List<Stockage> findByCuveIdAndDateFinIsNull(Long cuveId);
    List<Stockage> findByLotIdAndDateFinIsNull(Long lotId);
    List<Stockage> findByCuveIdOrderByDateDebutDesc(Long cuveId);
    List<Stockage> findByLotIdOrderByDateDebutDesc(Long lotId);
}
