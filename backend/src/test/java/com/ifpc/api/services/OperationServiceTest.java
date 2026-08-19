package com.ifpc.api.services;

import com.ifpc.api.models.*;
import com.ifpc.api.repositories.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link OperationService}.
 * Uses Mockito to mock all repositories, testing business logic in isolation.
 */
@ExtendWith(MockitoExtension.class)
class OperationServiceTest {

    @Mock private CuveRepository cuveRepository;
    @Mock private LotRepository lotRepository;
    @Mock private StockageRepository stockageRepository;
    @Mock private OperationRepository operationRepository;

    @InjectMocks private OperationService operationService;

    // ── Fixtures ────────────────────────────────────────────────────────────

    private Cuve buildCuve(Long id, String nom, String statut, Double volumeMax) {
        return Cuve.builder().id(id).nom(nom).statutPhysique(statut).volumeMax(volumeMax).deleted(false).build();
    }

    private Lot buildLot(Long id, String identifiant, Double volumeActuel) {
        return Lot.builder().id(id).identifiant(identifiant).typeProduit("jus_pomme").volumeActuel(volumeActuel).deleted(false).build();
    }

    private Stockage buildStockage(Long id, Cuve cuve, Lot lot, Double volumeOccupe) {
        return Stockage.builder().id(id).cuve(cuve).lot(lot).volumeOccupe(volumeOccupe).build();
    }

    // ── NETTOYAGE ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("nettoyage")
    class Nettoyage {

        @Test
        @DisplayName("should mark SALE cuve as PROPRE and create operation")
        void successSale() {
            Cuve cuve = buildCuve(1L, "C1", "SALE", 100.0);
            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            when(operationRepository.save(any(Operation.class)))
                    .thenAnswer(inv -> { Operation op = inv.getArgument(0); op.setId(10L); return op; });

            Operation result = operationService.nettoyage(1L, "user@test.com");

            assertEquals("PROPRE", cuve.getStatutPhysique());
            assertEquals("NETTOYAGE", result.getType());
            verify(cuveRepository).save(cuve);
        }

        @Test
        @DisplayName("should allow EN_NETTOYAGE cuve")
        void successEnNettoyage() {
            Cuve cuve = buildCuve(2L, "C2", "EN_NETTOYAGE", 100.0);
            when(cuveRepository.findById(2L)).thenReturn(Optional.of(cuve));
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.nettoyage(2L, "user@test.com");
            assertEquals("PROPRE", cuve.getStatutPhysique());
            assertEquals("NETTOYAGE", result.getType());
        }

        @Test
        @DisplayName("should throw when cuve is PROPRE")
        void failAlreadyPropre() {
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 100.0);
            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));

            assertThrows(IllegalStateException.class, () -> operationService.nettoyage(1L, "u@t.com"));
        }

        @Test
        @DisplayName("should throw when cuve not found")
        void failNotFound() {
            when(cuveRepository.findById(999L)).thenReturn(Optional.empty());
            assertThrows(IllegalArgumentException.class, () -> operationService.nettoyage(999L, "u@t.com"));
        }

        @Test
        @DisplayName("should throw when cuve is deleted")
        void failDeleted() {
            Cuve cuve = Cuve.builder().id(1L).nom("C1").statutPhysique("SALE").volumeMax(100.0).deleted(true).build();
            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            assertThrows(IllegalArgumentException.class, () -> operationService.nettoyage(1L, "u@t.com"));
        }
    }

    // ── REMPLISSAGE ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("remplissage")
    class Remplissage {

        @Test
        @DisplayName("should fill empty PROPRE cuve with lot volume")
        void successFull() {
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 100.0);
            Lot lot = buildLot(1L, "LOT-001", 50.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.remplissage(1L, 1L, 30.0, "user@test.com");

            assertEquals("REMPLISSAGE", result.getType());
            assertEquals(30.0, result.getVolume());
            verify(stockageRepository).save(any(Stockage.class));
        }

        @Test
        @DisplayName("should use all remaining volume when volume param is null")
        void nullVolumeUsesRest() {
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 100.0);
            Lot lot = buildLot(1L, "LOT-001", 50.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.remplissage(1L, 1L, null, "user@test.com");

            assertEquals(50.0, result.getVolume());
        }

        @Test
        @DisplayName("should throw when cuve is not PROPRE")
        void failNotPropre() {
            Cuve cuve = buildCuve(1L, "C1", "SALE", 100.0);
            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));

            assertThrows(IllegalStateException.class, () -> operationService.remplissage(1L, 1L, 10.0, "u@t.com"));
        }

        @Test
        @DisplayName("should throw when volume exceeds cuve capacity")
        void failExceedsCapacity() {
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 20.0);
            Lot lot = buildLot(1L, "LOT-001", 50.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());

            assertThrows(IllegalStateException.class, () -> operationService.remplissage(1L, 1L, 30.0, "u@t.com"));
        }

        @Test
        @DisplayName("should throw when requested volume exceeds lot stock")
        void failExceedsLotStock() {
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 100.0);
            Lot lot = buildLot(1L, "LOT-001", 10.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());

            assertThrows(IllegalStateException.class, () -> operationService.remplissage(1L, 1L, 30.0, "u@t.com"));
        }
    }

    // ── TRANSFERT ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("transfert")
    class Transfert {

        @Test
        @DisplayName("should transfer full volume and mark source SALE")
        void successFullTransfer() {
            Cuve src = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve dst = buildCuve(2L, "C2", "PROPRE", 100.0);
            Lot lot = buildLot(1L, "LOT-001", 50.0);
            Stockage srcStockage = buildStockage(1L, src, lot, 50.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(src));
            when(cuveRepository.findById(2L)).thenReturn(Optional.of(dst));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L))
                    .thenReturn(new ArrayList<>(List.of(srcStockage)))
                    .thenReturn(Collections.emptyList());  // after closing
            when(stockageRepository.findByCuveIdAndDateFinIsNull(2L)).thenReturn(Collections.emptyList());
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.transfert(1L, 2L, 1L, null, "user@test.com");

            assertEquals("TRANSFERT", result.getType());
            assertEquals(50.0, result.getVolume());
            assertEquals("SALE", src.getStatutPhysique());
        }

        @Test
        @DisplayName("should do partial transfer without marking source SALE")
        void successPartialTransfer() {
            Cuve src = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve dst = buildCuve(2L, "C2", "PROPRE", 100.0);
            Lot lot = buildLot(1L, "LOT-001", 80.0);
            Stockage srcStockage = buildStockage(1L, src, lot, 80.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(src));
            when(cuveRepository.findById(2L)).thenReturn(Optional.of(dst));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(List.of(srcStockage));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(2L)).thenReturn(Collections.emptyList());
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.transfert(1L, 2L, 1L, 30.0, "user@test.com");

            assertEquals(30.0, result.getVolume());
            assertEquals(50.0, srcStockage.getVolumeOccupe()); // 80 - 30
            assertEquals("PROPRE", src.getStatutPhysique()); // Not changed since there's still content
        }

        @Test
        @DisplayName("should throw when dest cuve is not PROPRE")
        void failDestNotPropre() {
            Cuve src = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve dst = buildCuve(2L, "C2", "SALE", 100.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(src));
            when(cuveRepository.findById(2L)).thenReturn(Optional.of(dst));

            assertThrows(IllegalStateException.class, () ->
                    operationService.transfert(1L, 2L, 1L, 10.0, "u@t.com"));
        }

        @Test
        @DisplayName("should throw when lot is not in source cuve")
        void failLotNotInSource() {
            Cuve src = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve dst = buildCuve(2L, "C2", "PROPRE", 100.0);
            Lot lot = buildLot(1L, "LOT-001", 50.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(src));
            when(cuveRepository.findById(2L)).thenReturn(Optional.of(dst));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());

            assertThrows(IllegalStateException.class, () ->
                    operationService.transfert(1L, 2L, 1L, 10.0, "u@t.com"));
        }

        @Test
        @DisplayName("should throw when volume exceeds source stockage")
        void failExceedsSourceVolume() {
            Cuve src = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve dst = buildCuve(2L, "C2", "PROPRE", 100.0);
            Lot lot = buildLot(1L, "LOT-001", 50.0);
            Stockage srcStockage = buildStockage(1L, src, lot, 20.0);

            when(cuveRepository.findById(1L)).thenReturn(Optional.of(src));
            when(cuveRepository.findById(2L)).thenReturn(Optional.of(dst));
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(List.of(srcStockage));

            assertThrows(IllegalStateException.class, () ->
                    operationService.transfert(1L, 2L, 1L, 30.0, "u@t.com"));
        }
    }

    // ── TRANSFORMATION ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("transformation")
    class Transformation {

        @Test
        @DisplayName("should update lot properties and create operation")
        void successFullTransformation() {
            Lot lot = buildLot(1L, "LOT-001", 50.0);
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 100.0);
            Stockage stockage = buildStockage(1L, cuve, lot, 50.0);

            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(List.of(stockage));
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.transformation(
                    1L, 65.0, -2.0, 30.0, "#FF8800", "{\"test\":true}", "Filtration", "user@test.com"
            );

            assertEquals("TRANSFORMATION", result.getType());
            assertEquals(65.0, lot.getColorL());
            assertEquals(-2.0, lot.getColorA());
            assertEquals(30.0, lot.getColorB());
            assertEquals("#FF8800", lot.getColorHex());
        }

        @Test
        @DisplayName("should handle null optional fields without updating them")
        void partialUpdate() {
            Lot lot = buildLot(1L, "LOT-001", 50.0);
            lot.setColorL(60.0);

            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            operationService.transformation(1L, null, null, null, null, null, null, "user@test.com");

            assertEquals(60.0, lot.getColorL()); // unchanged
        }

        @Test
        @DisplayName("should use default description when null")
        void defaultDescription() {
            Lot lot = buildLot(1L, "LOT-001", 50.0);

            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(stockageRepository.findByLotIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.transformation(1L, null, null, null, null, null, null, "user@test.com");

            assertTrue(result.getDescription().contains("LOT-001"));
        }
    }

    // ── ASSEMBLAGE ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("assemblage")
    class Assemblage {

        @Test
        @DisplayName("should merge source lots into new lot and save operation")
        void successAssemblage() {
            Cuve cSrc1 = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve cDst = buildCuve(3L, "C3", "PROPRE", 200.0);
            Lot lot1 = buildLot(10L, "LOT-1", 100.0);

            Stockage s1 = buildStockage(100L, cSrc1, lot1, 50.0);

            when(cuveRepository.findById(3L)).thenReturn(Optional.of(cDst));
            when(lotRepository.findById(10L)).thenReturn(Optional.of(lot1));
            when(stockageRepository.findByLotIdAndDateFinIsNull(10L)).thenReturn(List.of(s1));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(stockageRepository.findByCuveIdAndDateFinIsNull(3L)).thenReturn(Collections.emptyList());

            when(lotRepository.save(any(Lot.class))).thenAnswer(inv -> {
                Lot l = inv.getArgument(0);
                if (l.getId() == null) l.setId(99L);
                return l;
            });
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            OperationService.AssemblageSource src = new OperationService.AssemblageSource(1L, 10L, 50.0);
            Operation op = operationService.assemblage(
                    List.of(src), 3L, "LOT-MIX", "Cidre", 40.0, 10.0, 20.0, "#AABBCC", "{}", "user@test.com"
            );

            assertEquals("ASSEMBLAGE", op.getType());
            assertEquals(50.0, op.getVolume());
            assertEquals("SALE", cSrc1.getStatutPhysique());
            assertEquals(50.0, lot1.getVolumeActuel()); // 100 - 50
        }

        @Test
        @DisplayName("should throw when destination cuve is empty and not PROPRE")
        void failDestEmptyAndNotPropre() {
            Cuve cDst = buildCuve(3L, "C3", "SALE", 200.0);
            when(cuveRepository.findById(3L)).thenReturn(Optional.of(cDst));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(3L)).thenReturn(Collections.emptyList());

            OperationService.AssemblageSource src = new OperationService.AssemblageSource(1L, 10L, 50.0);
            assertThrows(IllegalStateException.class, () ->
                    operationService.assemblage(List.of(src), 3L, "LOT-MIX", "Cidre", null, null, null, null, null, "user@test.com"));
        }

        @Test
        @DisplayName("should throw when source lot is not in specified cuve")
        void failSourceLotNotInCuve() {
            Cuve cDst = buildCuve(3L, "C3", "PROPRE", 200.0);
            Lot lot1 = buildLot(10L, "LOT-1", 100.0);
            Cuve cOther = buildCuve(2L, "C2", "PROPRE", 100.0);
            Stockage s1 = buildStockage(100L, cOther, lot1, 50.0);

            when(cuveRepository.findById(3L)).thenReturn(Optional.of(cDst));
            when(lotRepository.findById(10L)).thenReturn(Optional.of(lot1));
            when(stockageRepository.findByLotIdAndDateFinIsNull(10L)).thenReturn(List.of(s1));

            OperationService.AssemblageSource src = new OperationService.AssemblageSource(1L, 10L, 50.0);
            assertThrows(IllegalStateException.class, () ->
                    operationService.assemblage(List.of(src), 3L, "LOT-MIX", "Cidre", null, null, null, null, null, "user@test.com"));
        }

        @Test
        @DisplayName("should throw when volume requested exceeds source stockage volume")
        void failSourceVolumeExceeded() {
            Cuve cSrc1 = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve cDst = buildCuve(3L, "C3", "PROPRE", 200.0);
            Lot lot1 = buildLot(10L, "LOT-1", 100.0);
            Stockage s1 = buildStockage(100L, cSrc1, lot1, 20.0);

            when(cuveRepository.findById(3L)).thenReturn(Optional.of(cDst));
            when(lotRepository.findById(10L)).thenReturn(Optional.of(lot1));
            when(stockageRepository.findByLotIdAndDateFinIsNull(10L)).thenReturn(List.of(s1));

            OperationService.AssemblageSource src = new OperationService.AssemblageSource(1L, 10L, 50.0);
            assertThrows(IllegalStateException.class, () ->
                    operationService.assemblage(List.of(src), 3L, "LOT-MIX", "Cidre", null, null, null, null, null, "user@test.com"));
        }

        @Test
        @DisplayName("should throw when total assemblage volume exceeds destination cuve capacity")
        void failDestCapacityExceeded() {
            Cuve cSrc1 = buildCuve(1L, "C1", "PROPRE", 100.0);
            Cuve cDst = buildCuve(3L, "C3", "PROPRE", 40.0);
            Lot lot1 = buildLot(10L, "LOT-1", 100.0);
            Stockage s1 = buildStockage(100L, cSrc1, lot1, 50.0);

            when(cuveRepository.findById(3L)).thenReturn(Optional.of(cDst));
            when(lotRepository.findById(10L)).thenReturn(Optional.of(lot1));
            when(stockageRepository.findByLotIdAndDateFinIsNull(10L)).thenReturn(List.of(s1));
            when(stockageRepository.findByCuveIdAndDateFinIsNull(1L)).thenReturn(Collections.emptyList());
            when(stockageRepository.findByCuveIdAndDateFinIsNull(3L)).thenReturn(Collections.emptyList());

            OperationService.AssemblageSource src = new OperationService.AssemblageSource(1L, 10L, 50.0);
            assertThrows(IllegalStateException.class, () ->
                    operationService.assemblage(List.of(src), 3L, "LOT-MIX", "Cidre", null, null, null, null, null, "user@test.com"));
        }
    }

    // ── LOG OPERATIONS ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("logging operations")
    class LogOperations {

        @Test
        @DisplayName("logCuveDeletion should create SUPPRESSION_CUVE operation")
        void logCuveDeletion() {
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 100.0);
            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.logCuveDeletion(1L, "admin@test.com");
            assertEquals("SUPPRESSION_CUVE", result.getType());
        }

        @Test
        @DisplayName("logCuveRestoration should create RESTAURATION_CUVE operation")
        void logCuveRestoration() {
            Cuve cuve = buildCuve(1L, "C1", "PROPRE", 100.0);
            when(cuveRepository.findById(1L)).thenReturn(Optional.of(cuve));
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.logCuveRestoration(1L, "admin@test.com");
            assertEquals("RESTAURATION_CUVE", result.getType());
        }

        @Test
        @DisplayName("logLotDeletion should create SUPPRESSION_LOT operation")
        void logLotDeletion() {
            Lot lot = buildLot(1L, "LOT-001", 50.0);
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.logLotDeletion(1L, "admin@test.com");
            assertEquals("SUPPRESSION_LOT", result.getType());
        }

        @Test
        @DisplayName("logLotRestoration should create RESTAURATION_LOT operation")
        void logLotRestoration() {
            Lot lot = buildLot(1L, "LOT-001", 50.0);
            when(lotRepository.findById(1L)).thenReturn(Optional.of(lot));
            when(operationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Operation result = operationService.logLotRestoration(1L, "admin@test.com");
            assertEquals("RESTAURATION_LOT", result.getType());
        }

        @Test
        @DisplayName("logCuveDeletion and restoration should throw when cuve not found")
        void logCuveNotFound() {
            when(cuveRepository.findById(999L)).thenReturn(Optional.empty());
            assertThrows(IllegalArgumentException.class, () -> operationService.logCuveDeletion(999L, "u@t.com"));
            assertThrows(IllegalArgumentException.class, () -> operationService.logCuveRestoration(999L, "u@t.com"));
        }

        @Test
        @DisplayName("logLotDeletion and restoration should throw when lot not found")
        void logLotNotFound() {
            when(lotRepository.findById(999L)).thenReturn(Optional.empty());
            assertThrows(IllegalArgumentException.class, () -> operationService.logLotDeletion(999L, "u@t.com"));
            assertThrows(IllegalArgumentException.class, () -> operationService.logLotRestoration(999L, "u@t.com"));
        }
    }
}
