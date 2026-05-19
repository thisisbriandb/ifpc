package com.ifpc.api.repositories;

import com.ifpc.api.models.Operation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OperationRepository extends JpaRepository<Operation, Long> {
    List<Operation> findByCuveSourceIdOrCuveDestIdOrderByCreatedAtDesc(Long cuveSourceId, Long cuveDestId);
    List<Operation> findByLotIdOrderByCreatedAtDesc(Long lotId);
    List<Operation> findByTypeOrderByCreatedAtDesc(String type);
    List<Operation> findTop50ByOrderByCreatedAtDesc();
}
