package com.ifpc.api.repositories;

import com.ifpc.api.models.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Accès au journal d'audit.
 *
 * <p>Aucune méthode de suppression n'est exposée, et ce n'est pas un oubli :
 * le journal est en ajout seul.</p>
 */
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findTop200ByOrderByCreatedAtDesc();

    List<AuditLog> findTop200ByCibleTypeOrderByCreatedAtDesc(String cibleType);
}
