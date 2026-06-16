package com.ifpc.api.repositories;

import com.ifpc.api.models.Operation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface OperationRepository extends JpaRepository<Operation, Long> {
    List<Operation> findByCuveSourceIdOrCuveDestIdOrderByCreatedAtDesc(Long cuveSourceId, Long cuveDestId);
    List<Operation> findByLotIdOrderByCreatedAtDesc(Long lotId);
    List<Operation> findByTypeOrderByCreatedAtDesc(String type);
    List<Operation> findTop50ByOrderByCreatedAtDesc();

    @Query("select o from Operation o where o.userId = :userId and (o.cuveSource.id = :cuveId or o.cuveDest.id = :cuveId) order by o.createdAt desc")
    List<Operation> findByUserIdAndCuveIdOrderByCreatedAtDesc(@Param("userId") Long userId, @Param("cuveId") Long cuveId);

    List<Operation> findByLotIdAndUserIdOrderByCreatedAtDesc(Long lotId, Long userId);
    List<Operation> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<Operation> findByIdAndUserId(Long id, Long userId);
}
