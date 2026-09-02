package com.ifpc.api.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ifpc.api.models.AuditAction;
import com.ifpc.api.models.AuditLog;
import com.ifpc.api.repositories.AuditLogRepository;
import com.ifpc.api.security.Tenant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/**
 * Écriture du journal d'audit.
 *
 * <p>Point de passage unique : l'acteur est toujours l'utilisateur
 * authentifié, jamais une valeur fournie par l'appelant.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    /**
     * Consigne une opération.
     *
     * <p>Une écriture de journal ne doit jamais faire échouer l'opération
     * qu'elle décrit : une panne du journal se signale dans les logs
     * applicatifs, elle ne bloque pas un administrateur. Ce compromis vaut
     * pour ce périmètre — il serait à revoir si le journal devait devenir
     * opposable à un tiers.</p>
     */
    public void consigner(AuditAction action, String cibleType, String cibleId, Map<String, Object> details) {
        try {
            auditLogRepository.save(AuditLog.builder()
                    .action(action)
                    .cibleType(cibleType)
                    .cibleId(cibleId)
                    .acteurEmail(Tenant.currentEmail())
                    .details(enJson(details))
                    .createdAt(Instant.now())
                    .build());
        } catch (Exception e) {
            log.error("Journal d'audit indisponible : {} sur {} {} non consigné",
                    action, cibleType, cibleId, e);
        }
    }

    private String enJson(Map<String, Object> details) {
        if (details == null || details.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
