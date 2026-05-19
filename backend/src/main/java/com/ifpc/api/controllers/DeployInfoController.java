package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/deploy")
@RequiredArgsConstructor
public class DeployInfoController {

    private static final String MARKER = "ifpc-backend-2026-05-19-cuves-auth-v2";

    private final CuveRepository cuveRepository;
    private final StockageRepository stockageRepository;

    @GetMapping("/info")
    public Map<String, Object> getDeployInfo() {
        return Map.of(
                "marker", MARKER,
                "checkedAt", Instant.now().toString(),
                "railwayCommitSha", env("RAILWAY_GIT_COMMIT_SHA"),
                "railwayDeploymentId", env("RAILWAY_DEPLOYMENT_ID"),
                "railwayEnvironment", env("RAILWAY_ENVIRONMENT_NAME")
        );
    }

    @GetMapping("/cuves-probe")
    public Map<String, Object> getCuvesProbe() {
        List<Cuve> cuves = cuveRepository.findByDeletedFalseOrderByNomAsc();
        Long firstCuveId = cuves.isEmpty() ? null : cuves.get(0).getId();
        int firstCuveActiveStockages = firstCuveId == null
                ? 0
                : stockageRepository.findByCuveIdAndDateFinIsNull(firstCuveId).size();

        return Map.of(
                "marker", MARKER,
                "checkedAt", Instant.now().toString(),
                "cuvesReadable", true,
                "cuvesCount", cuves.size(),
                "firstCuveId", firstCuveId == null ? "none" : firstCuveId,
                "firstCuveActiveStockages", firstCuveActiveStockages
        );
    }

    private String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? "unknown" : value;
    }
}
