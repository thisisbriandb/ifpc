package com.ifpc.api.repositories;

import com.ifpc.api.models.AnalysisHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AnalysisHistoryRepository extends JpaRepository<AnalysisHistory, Long> {

    // Les analyses supprimées restent en base mais sortent de l'historique
    // consultable : la suppression est logique, jamais physique.
    List<AnalysisHistory> findTop50ByUserEmailAndDeletedFalseOrderByCreatedAtDesc(String userEmail);

    Optional<AnalysisHistory> findByIdAndUserEmailAndDeletedFalse(Long id, String userEmail);
}
