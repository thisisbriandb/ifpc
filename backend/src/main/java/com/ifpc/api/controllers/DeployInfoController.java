package com.ifpc.api.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/deploy")
public class DeployInfoController {

    private static final String MARKER = "ifpc-backend-2026-05-19-cuves-diagnostic";

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

    private String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? "unknown" : value;
    }
}
