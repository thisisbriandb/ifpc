package com.ifpc.api.controllers;

import jakarta.servlet.http.HttpServletRequest;
import com.ifpc.api.models.Cuve;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
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

    private static final String MARKER = "ifpc-backend-2026-05-19-cuves-schema-repair-v5";

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
