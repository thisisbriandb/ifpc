package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.repositories.CuveRepository;
import com.ifpc.api.repositories.LotRepository;
import com.ifpc.api.repositories.StockageRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StockageControllerTest {

    @Mock private StockageRepository stockageRepository;
    @Mock private CuveRepository cuveRepository;
    @Mock private LotRepository lotRepository;

    @InjectMocks private StockageController stockageController;

    @Test
    @DisplayName("getActiveStockages, getStockagesByCuve, getStockagesByLot")
    void testGetStockages() {
        Cuve cuve = Cuve.builder().id(1L).nom("Cuve 1").build();
        Lot lot = Lot.builder().id(10L).identifiant("LOT-10").typeProduit("Jus").colorHex("#FFF").build();
        Stockage sActive = Stockage.builder().id(100L).cuve(cuve).lot(lot).volumeOccupe(500.0).dateDebut(LocalDateTime.now()).dateFin(null).build();
        Stockage sEnded = Stockage.builder().id(101L).cuve(cuve).lot(lot).volumeOccupe(500.0).dateDebut(LocalDateTime.now().minusDays(1)).dateFin(LocalDateTime.now()).build();

        when(stockageRepository.findAll()).thenReturn(List.of(sActive, sEnded));
        when(stockageRepository.findByCuveIdOrderByDateDebutDesc(1L)).thenReturn(List.of(sActive, sEnded));
        when(stockageRepository.findByLotIdOrderByDateDebutDesc(10L)).thenReturn(List.of(sActive, sEnded));

        List<Map<String, Object>> activeList = stockageController.getActiveStockages();
        assertEquals(1, activeList.size());

        List<Map<String, Object>> cuveList = stockageController.getStockagesByCuve(1L);
        assertEquals(2, cuveList.size());

        List<Map<String, Object>> lotList = stockageController.getStockagesByLot(10L);
        assertEquals(2, lotList.size());
    }

    @Test
    @DisplayName("createStockage validates cuve/lot presence and volume capacity")
    void testCreateStockage() {
        Cuve cuve = Cuve.builder().id(1L).nom("Cuve 1").volumeMax(1000.0).deleted(false).build();
        Lot lot = Lot.builder().id(10L).identifiant("LOT-10").typeProduit("Jus").colorHex("#FFF").deleted(false).build();

        when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
        when(lotRepository.findById(10L)).thenReturn(Optional.of(lot));
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
    @DisplayName("createStockage returns 400 when cuve or lot are missing or deleted")
    void testCreateStockageMissingCuveOrLot() {
        when(cuveRepository.findById(1L)).thenReturn(Optional.empty());
        ResponseEntity<?> missingCuveResp = stockageController.createStockage(new StockageController.CreateStockageRequest(1L, 10L, 100.0));
        assertEquals(HttpStatus.BAD_REQUEST, missingCuveResp.getStatusCode());

        Cuve cuve = Cuve.builder().id(1L).deleted(false).build();
        when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
        when(lotRepository.findById(10L)).thenReturn(Optional.empty());
        ResponseEntity<?> missingLotResp = stockageController.createStockage(new StockageController.CreateStockageRequest(1L, 10L, 100.0));
        assertEquals(HttpStatus.BAD_REQUEST, missingLotResp.getStatusCode());
    }

    @Test
    @DisplayName("terminerStockage sets dateFin and returns 404 when not found")
    void testTerminerStockage() {
        Cuve cuve = Cuve.builder().id(1L).nom("Cuve 1").build();
        Lot lot = Lot.builder().id(10L).identifiant("LOT-10").typeProduit("Jus").colorHex("#FFF").build();
        Stockage active = Stockage.builder().id(100L).cuve(cuve).lot(lot).volumeOccupe(500.0).dateDebut(LocalDateTime.now()).dateFin(null).build();

        when(stockageRepository.findById(100L)).thenReturn(Optional.of(active));
        when(stockageRepository.save(active)).thenReturn(active);

        ResponseEntity<Map<String, Object>> response = stockageController.terminerStockage(100L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(active.getDateFin());

        when(stockageRepository.findById(999L)).thenReturn(Optional.empty());
        ResponseEntity<Map<String, Object>> notFoundResp = stockageController.terminerStockage(999L);
        assertEquals(HttpStatus.NOT_FOUND, notFoundResp.getStatusCode());
    }
}
