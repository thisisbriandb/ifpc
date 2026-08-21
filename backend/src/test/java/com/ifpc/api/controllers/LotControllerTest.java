package com.ifpc.api.controllers;

import com.ifpc.api.models.Cuve;
import com.ifpc.api.models.Lot;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.Stockage;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.LotRepository;
import com.ifpc.api.repositories.StockageRepository;
import com.ifpc.api.services.OperationService;
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
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LotControllerTest {

    private static final String TENANT = "producteur-a@ifpc.eu";

    @Mock private LotRepository lotRepository;
    @Mock private StockageRepository stockageRepository;
    @Mock private OperationService operationService;

    @InjectMocks private LotController lotController;

    @BeforeEach
    void setUp() {
        authenticate(TENANT);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(String email) {
        User user = User.builder().email(email).role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    @Test
    @DisplayName("getAllLots returns only the current tenant's active lots")
    void testGetAllLots() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").ownerEmail(TENANT).typeProduit("Jus").volumeActuel(1000.0).deleted(false).build();
        Cuve cuve = Cuve.builder().id(5L).nom("Cuve 5").ownerEmail(TENANT).build();
        Stockage s = Stockage.builder().id(10L).cuve(cuve).lot(lot).volumeOccupe(1000.0).build();

        when(lotRepository.findByOwnerEmailAndDeletedFalseOrderByCreatedAtDesc(TENANT)).thenReturn(List.of(lot));
        when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(List.of(s));

        List<Map<String, Object>> lots = lotController.getAllLots();
        assertEquals(1, lots.size());
        assertEquals("LOT-1", lots.get(0).get("identifiant"));
        // volumeRestant is 0.0 (<= 0.1), so cuveActuelle is populated
        assertNotNull(lots.get(0).get("cuveActuelle"));
    }

    @Test
    @DisplayName("a lot stored in someone else's cuve never names that cuve")
    void testForeignCuveIsNotNamed() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").ownerEmail(TENANT).volumeActuel(1000.0).deleted(false).build();
        Cuve foreign = Cuve.builder().id(5L).nom("Cuve du voisin").ownerEmail("producteur-b@ifpc.eu").build();
        Stockage s = Stockage.builder().id(10L).cuve(foreign).lot(lot).volumeOccupe(1000.0).build();

        when(lotRepository.findByOwnerEmailAndDeletedFalseOrderByCreatedAtDesc(TENANT)).thenReturn(List.of(lot));
        when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(List.of(s));

        Map<String, Object> dto = lotController.getAllLots().get(0);
        // Le volume logé reste exact, mais la cuve d'autrui n'est pas nommée
        assertEquals(0.0, dto.get("volumeRestant"));
        assertNull(dto.get("cuveActuelle"));
    }

    @Test
    @DisplayName("getDeletedLots returns the current tenant's deleted lots")
    void testGetDeletedLots() {
        Lot lot = Lot.builder().id(2L).identifiant("LOT-2").ownerEmail(TENANT).deleted(true).deletedAt(LocalDateTime.now()).build();
        when(lotRepository.findByOwnerEmailAndDeletedTrueOrderByDeletedAtDesc(TENANT)).thenReturn(List.of(lot));

        List<Map<String, Object>> deleted = lotController.getDeletedLots();
        assertEquals(1, deleted.size());
    }

    @Test
    @DisplayName("getLotById returns lot or 404")
    void testGetLotById() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").ownerEmail(TENANT).deleted(false).build();
        when(lotRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(lot));
        when(lotRepository.findByIdAndOwnerEmail(2L, TENANT)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> resp1 = lotController.getLotById(1L);
        assertEquals(HttpStatus.OK, resp1.getStatusCode());

        ResponseEntity<Map<String, Object>> resp2 = lotController.getLotById(2L);
        assertEquals(HttpStatus.NOT_FOUND, resp2.getStatusCode());
    }

    @Test
    @DisplayName("a lot belonging to another tenant is unreachable, in read as in write")
    void testCrossTenantLotIsInvisible() {
        // Le dépôt ne rend rien pour ce locataire : le lot appartient à quelqu'un d'autre
        when(lotRepository.findByIdAndOwnerEmail(42L, TENANT)).thenReturn(Optional.empty());

        assertEquals(HttpStatus.NOT_FOUND, lotController.getLotById(42L).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, lotController.deleteLot(42L).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, lotController.restoreLot(42L).getStatusCode());

        LotController.UpdateLotRequest req = new LotController.UpdateLotRequest(
                null, "Cidre", null, null, null, null, null, null, null);
        assertEquals(HttpStatus.NOT_FOUND, lotController.updateLot(42L, req).getStatusCode());

        verify(lotRepository, never()).save(any(Lot.class));
    }

    @Test
    @DisplayName("an anonymous request is rejected instead of reading someone else's data")
    void testAnonymousIsRejected() {
        SecurityContextHolder.clearContext();

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> lotController.getAllLots());
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        verifyNoInteractions(lotRepository);
    }

    @Test
    @DisplayName("createLot stamps the current tenant as owner and applies defaults")
    void testCreateLotWithDefaults() {
        LotController.CreateLotRequest req = new LotController.CreateLotRequest(
                "LOT-DEF", "Jus", null, null, null, null, null, null, null
        );
        Lot saved = Lot.builder().id(10L).identifiant("LOT-DEF").ownerEmail(TENANT).typeProduit("Jus")
                .volumeActuel(0.0).statutLot("EN_FERMENTATION").deleted(false).build();

        when(lotRepository.findByOwnerEmailAndIdentifiantAndDeletedFalse(TENANT, "LOT-DEF")).thenReturn(Optional.empty());
        when(lotRepository.save(any(Lot.class))).thenReturn(saved);

        ResponseEntity<Map<String, Object>> response = lotController.createLot(req);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("LOT-DEF", response.getBody().get("identifiant"));

        org.mockito.ArgumentCaptor<Lot> captor = org.mockito.ArgumentCaptor.forClass(Lot.class);
        verify(lotRepository).save(captor.capture());
        assertEquals(TENANT, captor.getValue().getOwnerEmail());
    }

    @Test
    @DisplayName("createLot rejects an identifier already used by the same tenant")
    void testCreateLotDuplicateIdentifiant() {
        LotController.CreateLotRequest req = new LotController.CreateLotRequest(
                "LOT-1", "Jus", null, null, null, null, null, null, null
        );
        Lot existing = Lot.builder().id(1L).identifiant("LOT-1").ownerEmail(TENANT).deleted(false).build();
        when(lotRepository.findByOwnerEmailAndIdentifiantAndDeletedFalse(TENANT, "LOT-1")).thenReturn(Optional.of(existing));

        ResponseEntity<Map<String, Object>> response = lotController.createLot(req);
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        verify(lotRepository, never()).save(any(Lot.class));
    }

    @Test
    @DisplayName("updateLot updates all lot fields")
    void testUpdateLotAllFields() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-OLD").ownerEmail(TENANT).volumeActuel(100.0).deleted(false).build();
        when(lotRepository.findByOwnerEmailAndIdentifiantAndDeletedFalse(TENANT, "LOT-UPDATED")).thenReturn(Optional.empty());
        when(lotRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(lot));
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
    @DisplayName("updateLot rejects a rename onto another lot of the same tenant")
    void testUpdateLotDuplicateIdentifiant() {
        Lot other = Lot.builder().id(7L).identifiant("LOT-TAKEN").ownerEmail(TENANT).deleted(false).build();
        when(lotRepository.findByOwnerEmailAndIdentifiantAndDeletedFalse(TENANT, "LOT-TAKEN")).thenReturn(Optional.of(other));

        LotController.UpdateLotRequest req = new LotController.UpdateLotRequest(
                "LOT-TAKEN", null, null, null, null, null, null, null, null);

        ResponseEntity<Map<String, Object>> response = lotController.updateLot(1L, req);
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        verify(lotRepository, never()).save(any(Lot.class));
    }

    @Test
    @DisplayName("deleteLot handles operation logging exception")
    void testDeleteLotWithLoggingException() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").ownerEmail(TENANT).deleted(false).build();
        when(lotRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(lot));
        doThrow(new RuntimeException("Log fail")).when(operationService).logLotDeletion(1L, TENANT);

        ResponseEntity<Void> response = lotController.deleteLot(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(lot.getDeleted());
    }

    @Test
    @DisplayName("restoreLot handles operation logging exception")
    void testRestoreLotWithLoggingException() {
        Lot lot = Lot.builder().id(1L).identifiant("LOT-1").ownerEmail(TENANT).deleted(true).deletedAt(LocalDateTime.now()).build();
        when(lotRepository.findByIdAndOwnerEmail(1L, TENANT)).thenReturn(Optional.of(lot));
        when(lotRepository.save(lot)).thenReturn(lot);
        doThrow(new RuntimeException("Log fail")).when(operationService).logLotRestoration(1L, TENANT);

        ResponseEntity<Map<String, Object>> response = lotController.restoreLot(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertFalse(lot.getDeleted());
    }
}
