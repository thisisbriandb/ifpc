package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.LotRepository;
import com.ifpc.api.repositories.StockageRepository;
import org.junit.jupiter.api.AfterEach;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StockageControllerTest {

    private static final String TENANT = "producteur-a@ifpc.eu";

    @Mock private StockageRepository stockageRepository;
    @Mock private CuveRepository cuveRepository;
    @Mock private LotRepository lotRepository;

    @InjectMocks private StockageController stockageController;

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
    @DisplayName("getActiveStockages, getStockagesByCuve, getStockagesByLot are scoped to the tenant")
    void testGetStockages() {
        Cuve cuve = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).build();
        Lot lot = Lot.builder().id(10L).identifiant("LOT-10").ownerEmail(TENANT).typeProduit("Jus").colorHex("#FFF").build();
        Stockage sActive = Stockage.builder().id(100L).cuve(cuve).lot(lot).volumeOccupe(500.0).dateDebut(LocalDateTime.now()).dateFin(null).build();
        Stockage sEnded = Stockage.builder().id(101L).cuve(cuve).lot(lot).volumeOccupe(500.0).dateDebut(LocalDateTime.now().minusDays(1)).dateFin(LocalDateTime.now()).build();

        when(stockageRepository.findByCuve_OwnerEmailAndDateFinIsNull(TENANT)).thenReturn(List.of(sActive));
        when(stockageRepository.findByCuve_IdAndCuve_OwnerEmailOrderByDateDebutDesc(1L, TENANT)).thenReturn(List.of(sActive, sEnded));
        when(stockageRepository.findByLot_IdAndLot_OwnerEmailOrderByDateDebutDesc(10L, TENANT)).thenReturn(List.of(sActive, sEnded));

        List<Map<String, Object>> activeList = stockageController.getActiveStockages();
        assertEquals(1, activeList.size());

        List<Map<String, Object>> cuveList = stockageController.getStockagesByCuve(1L);
        assertEquals(2, cuveList.size());

        List<Map<String, Object>> lotList = stockageController.getStockagesByLot(10L);
        assertEquals(2, lotList.size());
    }

    @Test
    @DisplayName("another tenant's cuve or lot yields no stockage at all")
    void testCrossTenantStockagesAreEmpty() {
        when(stockageRepository.findByCuve_IdAndCuve_OwnerEmailOrderByDateDebutDesc(42L, TENANT)).thenReturn(List.of());
        when(stockageRepository.findByLot_IdAndLot_OwnerEmailOrderByDateDebutDesc(42L, TENANT)).thenReturn(List.of());

        assertTrue(stockageController.getStockagesByCuve(42L).isEmpty());
        assertTrue(stockageController.getStockagesByLot(42L).isEmpty());
    }

    @Test
    @DisplayName("createStockage validates cuve/lot presence and volume capacity")
    void testCreateStockage() {
        Cuve cuve = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).volumeMax(1000.0).deleted(false).build();
        Lot lot = Lot.builder().id(10L).identifiant("LOT-10").ownerEmail(TENANT).typeProduit("Jus").colorHex("#FFF").deleted(false).build();

        when(cuveRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(cuve));
        when(lotRepository.findByIdAndOwnerEmail(10L, TENANT)).thenReturn(Optional.of(lot));
        when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(List.of());

        Stockage saved = Stockage.builder().id(100L).cuve(cuve).lot(lot).volumeOccupe(600.0).dateDebut(LocalDateTime.now()).build();
        when(stockageRepository.save(any(Stockage.class))).thenReturn(saved);

        StockageController.CreateStockageRequest req = new StockageController.CreateStockageRequest(1L, 10L, 600.0);
        ResponseEntity<?> response = stockageController.createStockage(req);
        assertEquals(HttpStatus.OK, response.getStatusCode());

        // Test capacity error
        StockageController.CreateStockageRequest overflowReq = new StockageController.CreateStockageRequest(1L, 10L, 1200.0);
        ResponseEntity<?> errResp = stockageController.createStockage(overflowReq);
        assertEquals(HttpStatus.BAD_REQUEST, errResp.getStatusCode());
    }

    @Test
    @DisplayName("createStockage returns 400 when cuve or lot are missing, deleted or owned by someone else")
    void testCreateStockageMissingCuveOrLot() {
        when(cuveRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.empty());
        ResponseEntity<?> missingCuveResp = stockageController.createStockage(new StockageController.CreateStockageRequest(1L, 10L, 100.0));
        assertEquals(HttpStatus.BAD_REQUEST, missingCuveResp.getStatusCode());

        Cuve cuve = Cuve.builder().id(1L).ownerEmail(TENANT).deleted(false).build();
        when(cuveRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(cuve));
        when(lotRepository.findByIdAndOwnerEmail(10L, TENANT)).thenReturn(Optional.empty());
        ResponseEntity<?> missingLotResp = stockageController.createStockage(new StockageController.CreateStockageRequest(1L, 10L, 100.0));
        assertEquals(HttpStatus.BAD_REQUEST, missingLotResp.getStatusCode());

        verify(stockageRepository, never()).save(any(Stockage.class));
    }

    @Test
    @DisplayName("terminerStockage sets dateFin and returns 404 when not found or not owned")
    void testTerminerStockage() {
        Cuve cuve = Cuve.builder().id(1L).nom("Cuve 1").ownerEmail(TENANT).build();
        Lot lot = Lot.builder().id(10L).identifiant("LOT-10").ownerEmail(TENANT).typeProduit("Jus").colorHex("#FFF").build();
        Stockage active = Stockage.builder().id(100L).cuve(cuve).lot(lot).volumeOccupe(500.0).dateDebut(LocalDateTime.now()).dateFin(null).build();

        when(stockageRepository.findByIdAndCuve_OwnerEmail(100L, TENANT)).thenReturn(Optional.of(active));
        when(stockageRepository.save(active)).thenReturn(active);

        ResponseEntity<Map<String, Object>> response = stockageController.terminerStockage(100L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(active.getDateFin());

        when(stockageRepository.findByIdAndCuve_OwnerEmail(999L, TENANT)).thenReturn(Optional.empty());
        ResponseEntity<Map<String, Object>> notFoundResp = stockageController.terminerStockage(999L);
        assertEquals(HttpStatus.NOT_FOUND, notFoundResp.getStatusCode());
    }
}
