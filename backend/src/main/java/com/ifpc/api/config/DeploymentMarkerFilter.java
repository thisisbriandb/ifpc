package com.ifpc.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class DeploymentMarkerFilter extends OncePerRequestFilter {

    private static final String MARKER = "ifpc-backend-2026-05-19-cuves-auth-v2";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        response.setHeader("X-IFPC-Backend-Marker", MARKER);
        response.setHeader("X-IFPC-Railway-Commit", env("RAILWAY_GIT_COMMIT_SHA"));
        response.setHeader("X-IFPC-Railway-Deployment", env("RAILWAY_DEPLOYMENT_ID"));
        filterChain.doFilter(request, response);
    }

    private String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? "unknown" : value;
    }
}
