package com.ifpc.api.controllers;

import jakarta.servlet.http.HttpServletRequest;
import com.ifpc.api.repositories.CuveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Diagnostic de déploiement. Ces routes sont publiques (sonde de santé Docker
 * et vérification après mise en production) : elles ne renvoient donc jamais de
 * donnée appartenant à un locataire, et n'écrivent rien en base.
 */
@RestController
@RequestMapping("/api/deploy")
@RequiredArgsConstructor
public class DeployInfoController {

    private static final String MARKER = "ifpc-backend-2026-08-21-tenant-isolation-v12";

    private final CuveRepository cuveRepository;

    @GetMapping("/info")
    public Map<String, Object> getDeployInfo(HttpServletRequest request) {
        Map<String, Object> info = baseInfo();
        info.put("requestUri", request.getRequestURI());
        info.put("servletPath", request.getServletPath());
        info.put("method", request.getMethod());
        return info;
    }

    /** Vérifie que le schéma est lisible, sans exposer aucune cuve. */
    @GetMapping("/cuves-probe")
    public Map<String, Object> getCuvesProbe() {
        Map<String, Object> result = baseInfo();

        try {
            result.put("cuvesCount", cuveRepository.count());
            result.put("cuvesReadable", true);
        } catch (Throwable error) {
            result.put("cuvesReadable", false);
            result.put("errorClass", error.getClass().getName());
            result.put("errorMessage", error.getMessage() == null ? "none" : error.getMessage());
            Throwable cause = error.getCause();
            if (cause != null) {
                result.put("causeClass", cause.getClass().getName());
                result.put("causeMessage", cause.getMessage() == null ? "none" : cause.getMessage());
            }
        }

        return result;
    }

    private Map<String, Object> baseInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("marker", MARKER);
        info.put("checkedAt", Instant.now().toString());
        info.put("railwayCommitSha", env("RAILWAY_GIT_COMMIT_SHA"));
        info.put("railwayDeploymentId", env("RAILWAY_DEPLOYMENT_ID"));
        info.put("railwayEnvironment", env("RAILWAY_ENVIRONMENT_NAME"));
        return info;
    }

    private String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? "unknown" : value;
    }
}
