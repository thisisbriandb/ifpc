package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Operation;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.OperationRepository;
import com.ifpc.api.services.OperationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OperationControllerTest {

    @Mock private OperationRepository operationRepository;
    @Mock private OperationService operationService;

    @InjectMocks private OperationController operationController;

    private static final String TENANT = "op@ifpc.eu";

    @BeforeEach
    void setUp() {
        User user = User.builder().email(TENANT).role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    @org.junit.jupiter.api.AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("getRecentOperations, getOperationsByCuve, getOperationsByLot with fully populated Operation DTO")
    void testGetOperations() {
        Cuve cuveSrc = Cuve.builder().id(1L).nom("Cuve Src").build();
        Cuve cuveDst = Cuve.builder().id(2L).nom("Cuve Dst").build();
        Lot lotSrc = Lot.builder().id(10L).identifiant("LOT-10").build();
        Lot lotRes = Lot.builder().id(11L).identifiant("LOT-11").build();

        Operation op = Operation.builder()
                .id(100L)
                .type("TRANSFERT")
                .cuveSource(cuveSrc)
                .cuveDest(cuveDst)
                .lot(lotSrc)
                .lotResultat(lotRes)
                .volume(500.0)
                .description("Test Transfert")
                .userEmail("op@ifpc.eu")
                .createdAt(LocalDateTime.now())
                .build();

        when(operationRepository.findTop50ByUserEmailOrderByCreatedAtDesc(TENANT)).thenReturn(List.of(op));
        when(operationRepository.findByUserEmailAndCuve(TENANT, 1L)).thenReturn(List.of(op));
        when(operationRepository.findByUserEmailAndLotIdOrderByCreatedAtDesc(TENANT, 10L)).thenReturn(List.of(op));
        when(operationRepository.findByIdAndUserEmail(100L, TENANT)).thenReturn(Optional.of(op));

        List<Map<String, Object>> recent = operationController.getRecentOperations();
        assertEquals(1, recent.size());
        assertEquals("Cuve Src", recent.get(0).get("cuveSourceNom"));
        assertEquals("Cuve Dst", recent.get(0).get("cuveDestNom"));
        assertEquals("LOT-10", recent.get(0).get("lotIdentifiant"));
        assertEquals("LOT-11", recent.get(0).get("lotResultatIdentifiant"));

        List<Map<String, Object>> byCuve = operationController.getOperationsByCuve(1L);
        assertEquals(1, byCuve.size());

        List<Map<String, Object>> byLot = operationController.getOperationsByLot(10L);
        assertEquals(1, byLot.size());

        ResponseEntity<Map<String, Object>> byId = operationController.getOperationById(100L);
        assertEquals(HttpStatus.OK, byId.getStatusCode());
        assertEquals("TRANSFERT", byId.getBody().get("type"));
    }

    @Test
    @DisplayName("getOperationById returns 404 when not found or logged by another tenant")
    void testGetOperationByIdNotFound() {
        when(operationRepository.findByIdAndUserEmail(999L, TENANT)).thenReturn(Optional.empty());
        ResponseEntity<Map<String, Object>> response = operationController.getOperationById(999L);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("an anonymous request cannot read or trigger operations")
    void testAnonymousIsRejected() {
        SecurityContextHolder.clearContext();

        ResponseStatusException read = assertThrows(ResponseStatusException.class,
                () -> operationController.getRecentOperations());
        assertEquals(HttpStatus.UNAUTHORIZED, read.getStatusCode());

        ResponseStatusException write = assertThrows(ResponseStatusException.class,
                () -> operationController.nettoyage(new OperationController.NettoyageRequest(1L)));
        assertEquals(HttpStatus.UNAUTHORIZED, write.getStatusCode());

        verifyNoInteractions(operationRepository, operationService);
    }

    @Test
    @DisplayName("nettoyage operation endpoint success and error handling")
    void testNettoyage() {
        Operation op = Operation.builder().id(1L).type("NETTOYAGE").userEmail("op@ifpc.eu").build();
        when(operationService.nettoyage(1L, "op@ifpc.eu")).thenReturn(op);

        ResponseEntity<?> response = operationController.nettoyage(new OperationController.NettoyageRequest(1L));
        assertEquals(HttpStatus.OK, response.getStatusCode());

        when(operationService.nettoyage(2L, "op@ifpc.eu")).thenThrow(new RuntimeException("Cuve non vide"));
        ResponseEntity<?> errResponse = operationController.nettoyage(new OperationController.NettoyageRequest(2L));
        assertEquals(HttpStatus.BAD_REQUEST, errResponse.getStatusCode());
    }

    @Test
    @DisplayName("remplissage operation endpoint error handling")
    void testRemplissageError() {
        when(operationService.remplissage(1L, 10L, 500.0, "op@ifpc.eu")).thenThrow(new RuntimeException("Volume overflow"));

        ResponseEntity<?> response = operationController.remplissage(new OperationController.RemplissageRequest(1L, 10L, 500.0));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("transfert operation endpoint error handling")
    void testTransfertError() {
        when(operationService.transfert(1L, 2L, 10L, 500.0, "op@ifpc.eu")).thenThrow(new RuntimeException("Invalid dest cuve"));

        ResponseEntity<?> response = operationController.transfert(new OperationController.TransfertRequest(1L, 2L, 10L, 500.0));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("transformation operation endpoint error handling")
    void testTransformationError() {
        when(operationService.transformation(10L, 50.0, 10.0, 20.0, "#FFF", "{}", "Desc", "op@ifpc.eu")).thenThrow(new RuntimeException("Lot not found"));

        ResponseEntity<?> response = operationController.transformation(new OperationController.TransformationRequest(10L, 50.0, 10.0, 20.0, "#FFF", "{}", "Desc"));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("assemblage operation endpoint error handling")
    void testAssemblageError() {
        when(operationService.assemblage(anyList(), eq(3L), eq("LOT-ASS"), eq("Cidre"), eq(50.0), eq(10.0), eq(20.0), eq("#FFF"), eq("{}"), eq("op@ifpc.eu"))).thenThrow(new RuntimeException("Source lot missing"));

        OperationController.AssemblageRequest req = new OperationController.AssemblageRequest(
                List.of(new OperationController.AssemblageSourceDto(1L, 10L, 200.0)),
                3L, "LOT-ASS", "Cidre", 50.0, 10.0, 20.0, "#FFF", "{}"
        );

        ResponseEntity<?> response = operationController.assemblage(req);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }
}
