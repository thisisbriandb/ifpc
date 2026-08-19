package com.ifpc.api.security;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthDebugFilterTest {

    @Mock private HttpServletRequest request;
    @Mock private HttpServletResponse response;
    @Mock private FilterChain filterChain;

    @InjectMocks private AuthDebugFilter filter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("doFilterInternal sets debug response headers without auth")
    void testNoAuth() throws ServletException, IOException {
        when(request.getMethod()).thenReturn("GET");
        when(request.getServletPath()).thenReturn("/api/cuves");

        filter.doFilterInternal(request, response, filterChain);

        verify(response).setHeader("X-IFPC-Request-Method", "GET");
        verify(response).setHeader("X-IFPC-Request-Path", "/api/cuves");
        verify(response).setHeader("X-IFPC-Auth-Present", "false");
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("doFilterInternal sets debug response headers with authenticated user")
    void testWithAuth() throws ServletException, IOException {
        User user = User.builder().email("admin@ifpc.eu").role(Role.ADMIN).build();
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        when(request.getMethod()).thenReturn("POST");
        when(request.getServletPath()).thenReturn("/api/cuves");

        filter.doFilterInternal(request, response, filterChain);

        verify(response).setHeader("X-IFPC-Request-Method", "POST");
        verify(response).setHeader("X-IFPC-Request-Path", "/api/cuves");
        verify(response).setHeader("X-IFPC-Auth-Present", "true");
        verify(response).setHeader("X-IFPC-Auth-Name", "admin@ifpc.eu");
        verify(response).setHeader("X-IFPC-Auth-Authenticated", "true");
        verify(filterChain).doFilter(request, response);
    }
}
