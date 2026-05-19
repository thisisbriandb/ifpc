package com.ifpc.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.stream.Collectors;

@Component
public class AuthDebugFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        response.setHeader("X-IFPC-Request-Method", request.getMethod());
        response.setHeader("X-IFPC-Request-Path", request.getServletPath());
        response.setHeader("X-IFPC-Auth-Present", String.valueOf(authentication != null));

        if (authentication != null) {
            response.setHeader("X-IFPC-Auth-Name", value(authentication.getName()));
            response.setHeader("X-IFPC-Auth-Class", authentication.getClass().getSimpleName());
            response.setHeader("X-IFPC-Auth-Authenticated", String.valueOf(authentication.isAuthenticated()));
            response.setHeader("X-IFPC-Auth-Authorities", authentication.getAuthorities().stream()
                    .map(Object::toString)
                    .collect(Collectors.joining(",")));
        }

        filterChain.doFilter(request, response);
    }

    private String value(String raw) {
        return raw == null || raw.isBlank() ? "none" : raw;
    }
}
