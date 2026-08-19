package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeployInfoControllerTest {

    @Mock private CuveRepository cuveRepository;
    @Mock private StockageRepository stockageRepository;
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
    @DisplayName("getCuvesProbe returns database readability status when cuves exist")
    void testGetCuvesProbeWithCuves() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").build();
        when(cuveRepository.findByDeletedFalseOrderByNomAsc()).thenReturn(List.of(c1));
        when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(List.of());

        Map<String, Object> res = deployInfoController.getCuvesProbe();
        assertEquals(true, res.get("cuvesReadable"));
        assertEquals(1, res.get("cuvesCount"));
        assertEquals(1L, res.get("firstCuveId"));
        assertEquals(0, res.get("firstCuveActiveStockages"));
    }

    @Test
    @DisplayName("getCuvesProbe when cuves list is empty")
    void testGetCuvesProbeEmpty() {
        when(cuveRepository.findByDeletedFalseOrderByNomAsc()).thenReturn(List.of());

        Map<String, Object> res = deployInfoController.getCuvesProbe();
        assertEquals(true, res.get("cuvesReadable"));
        assertEquals(0, res.get("cuvesCount"));
        assertEquals("none", res.get("firstCuveId"));
        assertEquals(0, res.get("firstCuveActiveStockages"));
    }

    @Test
    @DisplayName("getCuvesProbe handles exception with cause and null messages")
    void testGetCuvesProbeExceptionWithCause() {
        Throwable cause = new IllegalArgumentException((String) null);
        Throwable error = new RuntimeException(null, cause);
        when(cuveRepository.findByDeletedFalseOrderByNomAsc()).thenThrow(error);

        Map<String, Object> res = deployInfoController.getCuvesProbe();
        assertEquals(false, res.get("cuvesReadable"));
        assertEquals("java.lang.RuntimeException", res.get("errorClass"));
        assertEquals("none", res.get("errorMessage"));
        assertEquals("java.lang.IllegalArgumentException", res.get("causeClass"));
        assertEquals("none", res.get("causeMessage"));
    }

    @Test
    @DisplayName("createCuveProbe POST creates cuve or returns instructions")
    void testCreateCuveProbe() {
        // Without request body
        Map<String, Object> resNoBody = deployInfoController.createCuveProbe(null);
        assertEquals(false, resNoBody.get("bodyReceived"));

        // With request body (statutPhysique null defaults to PROPRE)
        DeployInfoController.CreateCuveProbeRequest req = new DeployInfoController.CreateCuveProbeRequest("Probe", 5000.0, null);
        Cuve saved = Cuve.builder().id(99L).nom("Probe").volumeMax(5000.0).statutPhysique("PROPRE").build();
        when(cuveRepository.save(any(Cuve.class))).thenReturn(saved);

        Map<String, Object> resWithBody = deployInfoController.createCuveProbe(req);
        assertEquals(true, resWithBody.get("cuveCreated"));
        assertEquals(99L, resWithBody.get("id"));
    }

    @Test
    @DisplayName("createCuveProbe exception handling with cause")
    void testCreateCuveProbeException() {
        DeployInfoController.CreateCuveProbeRequest req = new DeployInfoController.CreateCuveProbeRequest("Probe", 5000.0, "PROPRE");
        Throwable cause = new RuntimeException("SubError");
        when(cuveRepository.save(any(Cuve.class))).thenThrow(new RuntimeException("MainError", cause));

        Map<String, Object> res = deployInfoController.createCuveProbe(req);
        assertEquals(false, res.get("cuveCreated"));
        assertEquals("MainError", res.get("errorMessage"));
        assertEquals("SubError", res.get("causeMessage"));
    }

    @Test
    @DisplayName("getCreateCuveProbeInfo GET returns diagnostic information and handles exceptions with cause")
    void testGetCreateCuveProbeInfo() {
        when(request.getRequestURI()).thenReturn("/api/deploy/cuves-create-probe");
        when(request.getServletPath()).thenReturn("/api/deploy/cuves-create-probe");
        when(request.getMethod()).thenReturn("GET");
        when(cuveRepository.findByDeletedFalseOrderByNomAsc()).thenReturn(List.of());

        Map<String, Object> res = deployInfoController.getCreateCuveProbeInfo(request);
        assertEquals(true, res.get("databaseReadable"));
        assertEquals(0, res.get("cuvesCount"));

        // Exception branch
        Throwable cause = new RuntimeException("DB Cause");
        when(cuveRepository.findByDeletedFalseOrderByNomAsc()).thenThrow(new RuntimeException("DB Fail", cause));
        Map<String, Object> errRes = deployInfoController.getCreateCuveProbeInfo(request);
        assertEquals(false, errRes.get("databaseReadable"));
        assertEquals("DB Fail", errRes.get("errorMessage"));
        assertEquals("DB Cause", errRes.get("causeMessage"));
    }
}
