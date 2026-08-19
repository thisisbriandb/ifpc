package com.ifpc.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeploymentMarkerFilterTest {

    @Mock private HttpServletRequest request;
    @Mock private HttpServletResponse response;
    @Mock private FilterChain filterChain;

    @InjectMocks private DeploymentMarkerFilter filter;

    @Test
    @DisplayName("doFilterInternal sets deployment marker headers")
    void testFilterHeaders() throws ServletException, IOException {
        filter.doFilterInternal(request, response, filterChain);

        verify(response).setHeader(eq("X-IFPC-Backend-Marker"), anyString());
        verify(response).setHeader(eq("X-IFPC-Railway-Commit"), anyString());
        verify(response).setHeader(eq("X-IFPC-Railway-Deployment"), anyString());
        verify(filterChain).doFilter(request, response);
    }
}
