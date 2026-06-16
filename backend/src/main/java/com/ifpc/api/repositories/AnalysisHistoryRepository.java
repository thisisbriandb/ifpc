package com.ifpc.api.repositories;

import com.ifpc.api.models.AnalysisHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnalysisHistoryRepository extends JpaRepository<AnalysisHistory, Long> {

    List<AnalysisHistory> findTop50ByOrderByCreatedAtDesc();

    List<AnalysisHistory> findByUserEmailOrderByCreatedAtDesc(String userEmail);

    List<AnalysisHistory> findTop50ByUserEmailOrderByCreatedAtDesc(String userEmail);
}
