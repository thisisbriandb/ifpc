package com.ifpc.api.repositories;

import com.ifpc.api.models.Operation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Le journal des opérations est cloisonné par locataire : « user_email » porte
 * l'auteur de l'opération, qui est aussi le propriétaire des cuves et lots
 * concernés (une opération ne peut pas franchir la frontière d'un locataire).
 */
@Repository
public interface OperationRepository extends JpaRepository<Operation, Long> {

    List<Operation> findTop50ByUserEmailOrderByCreatedAtDesc(String userEmail);

    List<Operation> findByUserEmailAndLotIdOrderByCreatedAtDesc(String userEmail, Long lotId);

    Optional<Operation> findByIdAndUserEmail(Long id, String userEmail);

    @Query("""
            select o from Operation o
            where o.userEmail = :userEmail
              and (o.cuveSource.id = :cuveId or o.cuveDest.id = :cuveId)
            order by o.createdAt desc
            """)
    List<Operation> findByUserEmailAndCuve(@Param("userEmail") String userEmail, @Param("cuveId") Long cuveId);
}
