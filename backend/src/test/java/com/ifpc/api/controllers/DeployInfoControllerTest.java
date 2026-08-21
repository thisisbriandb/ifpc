package com.ifpc.api.controllers;

import com.ifpc.api.repositories.CuveRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeployInfoControllerTest {

    @Mock private CuveRepository cuveRepository;
    @Mock private HttpServletRequest request;

    @InjectMocks private DeployInfoController deployInfoController;

    @Test
    @DisplayName("getDeployInfo returns marker and request info")
    void testGetDeployInfo() {
        when(request.getRequestURI()).thenReturn("/api/deploy/info");
        when(request.getServletPath()).thenReturn("/api/deploy/info");
        when(request.getMethod()).thenReturn("GET");

        Map<String, Object> res = deployInfoController.getDeployInfo(request);
        assertNotNull(res.get("marker"));
        assertEquals("/api/deploy/info", res.get("requestUri"));
    }

    @Test
    @DisplayName("getCuvesProbe reports readability with a count only — never a tenant's data")
    void testGetCuvesProbe() {
        when(cuveRepository.count()).thenReturn(3L);

        Map<String, Object> res = deployInfoController.getCuvesProbe();
        assertEquals(true, res.get("cuvesReadable"));
        assertEquals(3L, res.get("cuvesCount"));
        // Aucune identité de cuve n'est exposée sur cette route publique
        assertFalse(res.containsKey("firstCuveId"));
        assertFalse(res.containsKey("cuves"));
    }

    @Test
    @DisplayName("getCuvesProbe handles exception with cause and null messages")
    void testGetCuvesProbeExceptionWithCause() {
        Throwable cause = new IllegalArgumentException((String) null);
        when(cuveRepository.count()).thenThrow(new RuntimeException(null, cause));

        Map<String, Object> res = deployInfoController.getCuvesProbe();
        assertEquals(false, res.get("cuvesReadable"));
        assertEquals("java.lang.RuntimeException", res.get("errorClass"));
        assertEquals("none", res.get("errorMessage"));
        assertEquals("java.lang.IllegalArgumentException", res.get("causeClass"));
        assertEquals("none", res.get("causeMessage"));
    }
}
