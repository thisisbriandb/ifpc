package com.ifpc.api.controllers;

import jakarta.servlet.http.HttpServletRequest;
import com.ifpc.api.models.Cuve;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/deploy")
@RequiredArgsConstructor
public class DeployInfoController {

    private static final String MARKER = "ifpc-backend-2026-05-19-cuves-create-probe-v11";

    private final CuveRepository cuveRepository;
    private final StockageRepository stockageRepository;

    @GetMapping("/info")
    public Map<String, Object> getDeployInfo(HttpServletRequest request) {
        Map<String, Object> info = baseInfo();
        info.put("requestUri", request.getRequestURI());
        info.put("servletPath", request.getServletPath());
        info.put("method", request.getMethod());
        return info;
    }

    @GetMapping("/cuves-probe")
    public Map<String, Object> getCuvesProbe() {
        Map<String, Object> result = baseInfo();

        try {
            List<Cuve> cuves = cuveRepository.findByDeletedFalseOrderByNomAsc();
            Long firstCuveId = cuves.isEmpty() ? null : cuves.get(0).getId();
            int firstCuveActiveStockages = firstCuveId == null
                    ? 0
                    : stockageRepository.findByCuveIdAndDateFinIsNull(firstCuveId).size();

            result.put("cuvesReadable", true);
            result.put("cuvesCount", cuves.size());
            result.put("firstCuveId", firstCuveId == null ? "none" : firstCuveId);
            result.put("firstCuveActiveStockages", firstCuveActiveStockages);
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

    @PostMapping("/cuves-create-probe")
    public Map<String, Object> createCuveProbe(@RequestBody(required = false) CreateCuveProbeRequest request) {
        Map<String, Object> result = baseInfo();

        result.put("endpoint", "/api/deploy/cuves-create-probe");
        result.put("method", "POST");
        result.put("cuveCreated", false);

        if (request == null) {
            result.put("bodyReceived", false);
            result.put("message", "Aucune cuve creee: envoyez un body JSON en POST.");
            result.put("expectedBody", Map.of(
                    "nom", "Probe cuve",
                    "volumeMax", 1000,
                    "statutPhysique", "PROPRE"
            ));
            return result;
        }

        try {
            Cuve cuve = Cuve.builder()
                    .nom(request.nom())
                    .volumeMax(request.volumeMax())
                    .statutPhysique(request.statutPhysique() != null ? request.statutPhysique() : "PROPRE")
                    .build();
            Cuve saved = cuveRepository.save(cuve);

            result.put("cuveCreated", true);
            result.put("id", saved.getId());
            result.put("nom", saved.getNom());
            result.put("volumeMax", saved.getVolumeMax());
            result.put("statutPhysique", saved.getStatutPhysique());
        } catch (Throwable error) {
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

    @GetMapping("/cuves-create-probe")
    public Map<String, Object> getCreateCuveProbeInfo(HttpServletRequest request) {
        Map<String, Object> result = baseInfo();

        result.put("endpoint", "/api/deploy/cuves-create-probe");
        result.put("requestUri", request.getRequestURI());
        result.put("servletPath", request.getServletPath());
        result.put("method", request.getMethod());
        result.put("cuveCreated", false);
        result.put("message", "Diagnostic OK: cette URL est joignable en GET. La creation de cuve se fait uniquement en POST avec un body JSON.");
        result.put("expectedPostBody", Map.of(
                "nom", "Probe cuve",
                "volumeMax", 1000,
                "statutPhysique", "PROPRE"
        ));

        try {
            List<Cuve> cuves = cuveRepository.findByDeletedFalseOrderByNomAsc();
            result.put("databaseReadable", true);
            result.put("cuvesCount", cuves.size());
        } catch (Throwable error) {
            result.put("databaseReadable", false);
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

    public record CreateCuveProbeRequest(String nom, Double volumeMax, String statutPhysique) {}
}
