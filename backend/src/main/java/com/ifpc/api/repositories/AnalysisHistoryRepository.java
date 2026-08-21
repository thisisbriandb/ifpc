package com.ifpc.api.repositories;

import com.ifpc.api.models.AnalysisHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AnalysisHistoryRepository extends JpaRepository<AnalysisHistory, Long> {

    List<AnalysisHistory> findTop50ByUserEmailOrderByCreatedAtDesc(String userEmail);

    Optional<AnalysisHistory> findByIdAndUserEmail(Long id, String userEmail);
}
