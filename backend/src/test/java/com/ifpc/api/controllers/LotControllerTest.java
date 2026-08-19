package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.LotRepository;
import com.ifpc.api.repositories.StockageRepository;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LotControllerTest {

    @Mock private LotRepository lotRepository;
    @Mock private StockageRepository stockageRepository;
    @Mock private OperationService operationService;

    @InjectMocks private LotController lotController;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("getAllLots returns active lots mapped to DTOs")
    void testGetAllLots() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").typeProduit("Jus").volumeActuel(1000.0).deleted(false).build();
        Cuve cuve = Cuve.builder().id(5L).nom("Cuve 5").build();
        Stockage s = Stockage.builder().id(10L).cuve(cuve).lot(lot).volumeOccupe(1000.0).build();

        when(lotRepository.findByDeletedFalseOrderByCreatedAtDesc()).thenReturn(List.of(lot));
        when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(List.of(s));

        List<Map<String, Object>> lots = lotController.getAllLots();
        assertEquals(1, lots.size());
        assertEquals("LOT-1", lots.get(0).get("identifiant"));
        // volumeRestant is 0.0 (<= 0.1), so cuveActuelle is populated
        assertNotNull(lots.get(0).get("cuveActuelle"));
    }

    @Test
    @DisplayName("getDeletedLots returns deleted lots mapped to DTOs")
    void testGetDeletedLots() {
        Lot lot = Lot.builder().id(2L).identifiant("LOT-2").deleted(true).deletedAt(LocalDateTime.now()).build();
        when(lotRepository.findByDeletedTrueOrderByDeletedAtDesc()).thenReturn(List.of(lot));

        List<Map<String, Object>> deleted = lotController.getDeletedLots();
        assertEquals(1, deleted.size());
    }

    @Test
    @DisplayName("getLotById returns lot or 404")
    void testGetLotById() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").deleted(false).build();
        when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
        when(lotRepository.findById(2L)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> resp1 = lotController.getLotById(1L);
        assertEquals(HttpStatus.OK, resp1.getStatusCode());

        ResponseEntity<Map<String, Object>> resp2 = lotController.getLotById(2L);
        assertEquals(HttpStatus.NOT_FOUND, resp2.getStatusCode());
    }

    @Test
    @DisplayName("createLot creates and returns lot DTO with defaults for null fields")
    void testCreateLotWithDefaults() {
        LotController.CreateLotRequest req = new LotController.CreateLotRequest(
                "LOT-DEF", "Jus", null, null, null, null, null, null, null
        );
        Lot saved = Lot.builder().id(10L).identifiant("LOT-DEF").typeProduit("Jus").volumeActuel(0.0).statutLot("EN_FERMENTATION").deleted(false).build();

        when(lotRepository.save(any(Lot.class))).thenReturn(saved);

        ResponseEntity<Map<String, Object>> response = lotController.createLot(req);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("LOT-DEF", response.getBody().get("identifiant"));
    }

    @Test
    @DisplayName("updateLot updates all lot fields")
    void testUpdateLotAllFields() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-OLD").volumeActuel(100.0).deleted(false).build();
        when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
        when(lotRepository.save(lot)).thenReturn(lot);

        LotController.UpdateLotRequest req = new LotController.UpdateLotRequest(
                "LOT-UPDATED", "Cidre Brut", 200.0, 50.0, 10.0, 20.0, "#FFFFFF", "{}", "PRET_A_ASSEMBLER"
        );

        ResponseEntity<Map<String, Object>> response = lotController.updateLot(1L, req);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("LOT-UPDATED", lot.getIdentifiant());
        assertEquals("Cidre Brut", lot.getTypeProduit());
        assertEquals(200.0, lot.getVolumeActuel());
        assertEquals(50.0, lot.getColorL());
        assertEquals(10.0, lot.getColorA());
        assertEquals(20.0, lot.getColorB());
        assertEquals("#FFFFFF", lot.getColorHex());
        assertEquals("{}", lot.getSpectrumJson());
        assertEquals("PRET_A_ASSEMBLER", lot.getStatutLot());
    }

    @Test
    @DisplayName("deleteLot handles operation logging exception")
    void testDeleteLotWithLoggingException() {
        User user = User.builder().email("admin@ifpc.eu").role(Role.ADMIN).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").deleted(false).build();
        when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
        doThrow(new RuntimeException("Log fail")).when(operationService).logLotDeletion(1L, "admin@ifpc.eu");

        ResponseEntity<Void> response = lotController.deleteLot(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(lot.getDeleted());
    }

    @Test
    @DisplayName("restoreLot handles operation logging exception and unauthenticated user")
    void testRestoreLotWithLoggingException() {
        SecurityContextHolder.clearContext(); // Anonymous/unauthenticated user

        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").deleted(true).deletedAt(LocalDateTime.now()).build();
        when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
        when(lotRepository.save(lot)).thenReturn(lot);
        doThrow(new RuntimeException("Log fail")).when(operationService).logLotRestoration(1L, null);

        ResponseEntity<Map<String, Object>> response = lotController.restoreLot(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertFalse(lot.getDeleted());
    }
}
