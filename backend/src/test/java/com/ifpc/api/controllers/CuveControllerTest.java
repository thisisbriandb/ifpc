package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.StockageRepository;
import com.ifpc.api.services.OperationService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
class CuveControllerTest {

    private static final String TENANT = "producteur-a@ifpc.eu";

    @Mock private CuveRepository cuveRepository;
    @Mock private StockageRepository stockageRepository;
    @Mock private OperationService operationService;
    @Mock private HttpServletResponse httpServletResponse;

    @InjectMocks private CuveController cuveController;

    @BeforeEach
    void setUp() {
        User user = User.builder().email(TENANT).role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("getAllCuves returns only the current tenant's active cuves")
    void testGetAllCuves() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).statutPhysique("PROPRE").deleted(false).build();
        Lot l1 = Lot.builder().id(10L).identifiant("LOT-1").ownerEmail(TENANT).typeProduit("Jus").colorHex("#FFF").build();
        Stockage s1 = Stockage.builder().id(100L).cuve(c1).lot(l1).volumeOccupe(2000.0).dateDebut(LocalDateTime.now()).build();

        when(cuveRepository.findByOwnerEmailAndDeletedFalseOrderByNomAsc(TENANT)).thenReturn(List.of(c1));
        when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(List.of(s1));

        ResponseEntity<?> response = cuveController.getAllCuves();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> list = (List<Map<String, Object>>) response.getBody();
        assertEquals(1, list.size());
        assertEquals("Cuve 1", list.get(0).get("nom"));
        assertEquals(2000.0, list.get(0).get("volumeOccupe"));
    }

    @Test
    @DisplayName("a cuve holding someone else's lot never names that lot")
    void testForeignLotIsNotNamed() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).statutPhysique("PROPRE").deleted(false).build();
        Lot foreign = Lot.builder().id(10L).identifiant("LOT-DU-VOISIN").ownerEmail("producteur-b@ifpc.eu").typeProduit("Jus").colorHex("#FFF").build();
        Stockage s1 = Stockage.builder().id(100L).cuve(c1).lot(foreign).volumeOccupe(2000.0).dateDebut(LocalDateTime.now()).build();

        when(cuveRepository.findByOwnerEmailAndDeletedFalseOrderByNomAsc(TENANT)).thenReturn(List.of(c1));
        when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(List.of(s1));

        List<Map<String, Object>> list = (List<Map<String, Object>>) cuveController.getAllCuves().getBody();
        Map<String, Object> dto = list.get(0);
        // L'occupation physique reste juste, l'identité du lot d'autrui non exposée
        assertEquals(2000.0, dto.get("volumeOccupe"));
        assertTrue(((List<?>) dto.get("stockages")).isEmpty());
    }

    @Test
    @DisplayName("getAllCuves returns 500 when repository throws exception")
    void testGetAllCuvesError() {
        when(cuveRepository.findByOwnerEmailAndDeletedFalseOrderByNomAsc(TENANT)).thenThrow(new RuntimeException("DB error"));

        ResponseEntity<?> response = cuveController.getAllCuves();
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    @DisplayName("an anonymous request is rejected rather than swallowed into a 500")
    void testAnonymousIsRejected() {
        SecurityContextHolder.clearContext();

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> cuveController.getAllCuves());
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        verifyNoInteractions(cuveRepository);
    }

    @Test
    @DisplayName("getDeletedCuves returns deleted cuves list")
    void testGetDeletedCuves() {
        Cuve c1 = Cuve.builder().id(2L).nom("Cuve 2").ownerEmail(TENANT).volumeMax(5000.0).deleted(true).build();
        when(cuveRepository.findByOwnerEmailAndDeletedTrueOrderByDeletedAtDesc(TENANT)).thenReturn(List.of(c1));

        ResponseEntity<?> response = cuveController.getDeletedCuves();
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    @DisplayName("getCuveById returns 200 when found and 404 when not found or deleted")
    void testGetCuveById() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).deleted(false).build();
        when(cuveRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(c1));
        when(cuveRepository.findByIdAndOwnerEmail(2L, TENANT)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> okResp = cuveController.getCuveById(1L);
        assertEquals(HttpStatus.OK, okResp.getStatusCode());

        ResponseEntity<Map<String, Object>> notFoundResp = cuveController.getCuveById(2L);
        assertEquals(HttpStatus.NOT_FOUND, notFoundResp.getStatusCode());
    }

    @Test
    @DisplayName("a cuve belonging to another tenant is unreachable, in read as in write")
    void testCrossTenantCuveIsInvisible() {
        when(cuveRepository.findByIdAndOwnerEmail(42L, TENANT)).thenReturn(Optional.empty());

        assertEquals(HttpStatus.NOT_FOUND, cuveController.getCuveById(42L).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, cuveController.deleteCuve(42L).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, cuveController.restoreCuve(42L).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND,
                cuveController.updateCuve(42L, new CuveController.UpdateCuveRequest("Pirate", null, null)).getStatusCode());

        verify(cuveRepository, never()).save(any(Cuve.class));
    }

    @Test
    @DisplayName("updateCuvesLayout refuses a batch containing a cuve of another tenant")
    void testUpdateCuvesLayoutCrossTenant() {
        Cuve mine = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).deleted(false).build();
        // La cuve 2 appartient à un autre locataire : le dépôt ne la renvoie pas
        when(cuveRepository.findByIdInAndOwnerEmail(List.of(1L, 2L), TENANT)).thenReturn(List.of(mine));

        ResponseEntity<?> response = cuveController.updateCuvesLayout(List.of(
                new CuveController.UpdateCuveLayoutRequest(1L, 15.0, 25.0),
                new CuveController.UpdateCuveLayoutRequest(2L, 30.0, 40.0)
        ));

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(cuveRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("createCuve stamps the owner, formats name and defaults statutPhysique when null")
    void testCreateCuveWithNullStatut() {
        CuveController.CreateCuveRequest req = new CuveController.CreateCuveRequest("Cuve 01", 10000.0, null);
        Cuve saved = Cuve.builder().id(1L).nom("Cuve 01").ownerEmail(TENANT).volumeMax(10000.0).statutPhysique("PROPRE").deleted(false).build();

        when(cuveRepository.save(any(Cuve.class))).thenReturn(saved);

        ResponseEntity<?> response = cuveController.createCuve(req, httpServletResponse);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(httpServletResponse).setHeader("X-IFPC-Cuve-Controller", "create");

        ArgumentCaptor<Cuve> captor = ArgumentCaptor.forClass(Cuve.class);
        verify(cuveRepository).save(captor.capture());
        assertEquals(TENANT, captor.getValue().getOwnerEmail());
        assertEquals("PROPRE", captor.getValue().getStatutPhysique());
    }

    @Test
    @DisplayName("updateCuvesLayout updates X/Y coordinates")
    void testUpdateCuvesLayout() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).deleted(false).build();
        when(cuveRepository.findByIdInAndOwnerEmail(List.of(1L), TENANT)).thenReturn(List.of(c1));
        when(cuveRepository.saveAll(anyList())).thenReturn(List.of(c1));

        List<CuveController.UpdateCuveLayoutRequest> req = List.of(new CuveController.UpdateCuveLayoutRequest(1L, 15.0, 25.0));
        ResponseEntity<?> response = cuveController.updateCuvesLayout(req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(15.0, c1.getPlanX());
        assertEquals(25.0, c1.getPlanY());
    }

    @Test
    @DisplayName("updateCuve with partial null request fields")
    void testUpdateCuvePartialNulls() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).statutPhysique("PROPRE").deleted(false).build();
        when(cuveRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(c1));
        when(cuveRepository.save(c1)).thenReturn(c1);

        CuveController.UpdateCuveRequest req = new CuveController.UpdateCuveRequest(null, null, null);
        ResponseEntity<Map<String, Object>> response = cuveController.updateCuve(1L, req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Cuve 1", c1.getNom());
    }

    @Test
    @DisplayName("deleteCuve sets deleted true and handles logging exception")
    void testDeleteCuveWithLoggingException() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).deleted(false).build();
        when(cuveRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(c1));
        doThrow(new RuntimeException("Log fail")).when(operationService).logCuveDeletion(1L, TENANT);

        ResponseEntity<Void> response = cuveController.deleteCuve(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(c1.getDeleted());
    }

    @Test
    @DisplayName("restoreCuve resets deleted flag and returns 404 if not found")
    void testRestoreCuveNotFound() {
        when(cuveRepository.findByIdAndOwnerEmail(99L, TENANT)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = cuveController.restoreCuve(99L);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("restoreCuve handles operation logging exception")
    void testRestoreCuveWithLoggingException() {
        Cuve c1 = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(10000.0).deleted(true).deletedAt(LocalDateTime.now()).build();
        when(cuveRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(c1));
        when(cuveRepository.save(c1)).thenReturn(c1);
        doThrow(new RuntimeException("Log fail")).when(operationService).logCuveRestoration(1L, TENANT);

        ResponseEntity<Map<String, Object>> response = cuveController.restoreCuve(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertFalse(c1.getDeleted());
    }
}
