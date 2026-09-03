package com.ifpc.api.models;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;

import java.time.LocalDateTime;
import java.util.Collection;

import static org.junit.jupiter.api.Assertions.*;

class ModelTest {

    @Test
    @DisplayName("User entity methods, builder and UserDetails interface")
    void testUser() {
        User user = User.builder()
                .id(1L)
                .firstName("John")
                .lastName("Doe")
                .companyName("Acme")
                .companyRole("Tech Lead")
                .email("john@acme.com")
                .password("secret")
                .role(Role.ADMIN)
                .enabled(true)
                .lastLogin(LocalDateTime.now())
                .resetPasswordToken("token123")
                .resetPasswordTokenExpiry(LocalDateTime.now().plusHours(1))
                .build();

        assertEquals(1L, user.getId());
        assertEquals("John", user.getFirstName());
        assertEquals("Doe", user.getLastName());
        assertEquals("Acme", user.getCompanyName());
        assertEquals("Tech Lead", user.getCompanyRole());
        assertEquals("john@acme.com", user.getEmail());
        assertEquals("secret", user.getPassword());
        assertEquals(Role.ADMIN, user.getRole());
        assertTrue(user.isEnabled());
        assertNotNull(user.getLastLogin());
        assertEquals("token123", user.getResetPasswordToken());
        assertNotNull(user.getResetPasswordTokenExpiry());

        // UserDetails methods
        assertEquals("john@acme.com", user.getUsername());
        assertTrue(user.isAccountNonExpired());
        assertTrue(user.isAccountNonLocked());
        assertTrue(user.isCredentialsNonExpired());

        Collection<? extends GrantedAuthority> authorities = user.getAuthorities();
        assertEquals(1, authorities.size());
        assertEquals("ROLE_ADMIN", authorities.iterator().next().getAuthority());

        // Test NoArgsConstructor and Setters
        User emptyUser = new User();
        emptyUser.setRole(Role.USER);
        assertEquals("ROLE_USER", emptyUser.getAuthorities().iterator().next().getAuthority());
    }

    @Test
    @DisplayName("Cuve entity lifecycle and methods")
    void testCuve() {
        Cuve cuve = Cuve.builder()
                .id(10L)
                .nom("Cuve A")
                .volumeMax(5000.0)
                .statutPhysique("PROPRE")
                .deleted(false)
                .deletedAt(null)
                .planX(100.0)
                .planY(200.0)
                .build();

        assertEquals(10L, cuve.getId());
        assertEquals("Cuve A", cuve.getNom());
        assertEquals(5000.0, cuve.getVolumeMax());
        assertEquals("PROPRE", cuve.getStatutPhysique());
        assertFalse(cuve.getDeleted());
        assertEquals(100.0, cuve.getPlanX());
        assertEquals(200.0, cuve.getPlanY());

        // PrePersist & PreUpdate
        cuve.onCreate();
        assertNotNull(cuve.getCreatedAt());
        assertNotNull(cuve.getUpdatedAt());

        LocalDateTime prevUpdate = cuve.getUpdatedAt();
        cuve.onUpdate();
        assertTrue(!cuve.getUpdatedAt().isBefore(prevUpdate));

        Cuve emptyCuve = new Cuve();
        assertNotNull(emptyCuve);
    }

    @Test
    @DisplayName("Lot entity lifecycle and methods")
    void testLot() {
        Lot lot = Lot.builder()
                .id(5L)
                .identifiant("LOT-2026-001")
                .typeProduit("Jus de Pomme")
                .volumeActuel(1200.0)
                .colorL(45.0)
                .colorA(12.0)
                .colorB(30.0)
                .colorHex("#FFA500")
                .spectrumJson("{\"400nm\": 0.5}")
                .statutLot("EN_FERMENTATION")
                .deleted(false)
                .build();

        assertEquals(5L, lot.getId());
        assertEquals("LOT-2026-001", lot.getIdentifiant());
        assertEquals("Jus de Pomme", lot.getTypeProduit());
        assertEquals(1200.0, lot.getVolumeActuel());
        assertEquals(45.0, lot.getColorL());
        assertEquals(12.0, lot.getColorA());
        assertEquals(30.0, lot.getColorB());
        assertEquals("#FFA500", lot.getColorHex());
        assertEquals("{\"400nm\": 0.5}", lot.getSpectrumJson());
        assertEquals("EN_FERMENTATION", lot.getStatutLot());

        lot.onCreate();
        assertNotNull(lot.getCreatedAt());
        assertNotNull(lot.getUpdatedAt());

        lot.onUpdate();
        assertNotNull(lot.getUpdatedAt());
    }

    @Test
    @DisplayName("Operation entity lifecycle and methods")
    void testOperation() {
        Cuve cuveSrc = Cuve.builder().id(1L).nom("Cuve 1").build();
        Cuve cuveDest = Cuve.builder().id(2L).nom("Cuve 2").build();
        Lot lot = Lot.builder().id(1L).identifiant("LOT-01").build();

        Operation op = Operation.builder()
                .id(100L)
                .type("TRANSFERT")
                .cuveSource(cuveSrc)
                .cuveDest(cuveDest)
                .lot(lot)
                .volume(500.0)
                .description("Transfert de jus")
                .userEmail("user@test.com")
                .build();

        assertEquals(100L, op.getId());
        assertEquals("TRANSFERT", op.getType());
        assertEquals(cuveSrc, op.getCuveSource());
        assertEquals(cuveDest, op.getCuveDest());
        assertEquals(lot, op.getLot());
        assertEquals(500.0, op.getVolume());
        assertEquals("Transfert de jus", op.getDescription());
        assertEquals("user@test.com", op.getUserEmail());

        op.onCreate();
        assertNotNull(op.getCreatedAt());
    }

    @Test
    @DisplayName("Stockage entity lifecycle and methods")
    void testStockage() {
        Cuve cuve = Cuve.builder().id(1L).build();
        Lot lot = Lot.builder().id(1L).build();

        Stockage st = Stockage.builder()
                .id(1L)
                .cuve(cuve)
                .lot(lot)
                .volumeOccupe(300.0)
                .build();

        st.onCreate();
        assertNotNull(st.getDateDebut());
        assertEquals(cuve, st.getCuve());
        assertEquals(lot, st.getLot());
        assertEquals(300.0, st.getVolumeOccupe());

        st.setDateFin(LocalDateTime.now());
        assertNotNull(st.getDateFin());
    }

    @Test
    @DisplayName("AnalysisHistory entity lifecycle and methods")
    void testAnalysisHistory() {
        AnalysisHistory ah = AnalysisHistory.builder()
                .id(1L)
                .type("bareme")
                .label("Analyse Pasteurisation")
                .lotIdentifier("LOT-99")
                .statut("conforme")
                .vp(15.5)
                .vpCible(15.0)
                .parametres("{\"tRef\": 80}")
                .courbe("[1,2,3]")
                .resultJson("{\"ok\": true}")
                .userEmail("tester@ifpc.eu")
                .build();

        ah.onCreate();
        assertEquals(1L, ah.getId());
        assertEquals("bareme", ah.getType());
        assertEquals("Analyse Pasteurisation", ah.getLabel());
        assertEquals("LOT-99", ah.getLotIdentifier());
        assertEquals("conforme", ah.getStatut());
        assertEquals(15.5, ah.getVp());
        assertEquals(15.0, ah.getVpCible());
        assertEquals("{\"tRef\": 80}", ah.getParametres());
        assertEquals("[1,2,3]", ah.getCourbe());
        assertEquals("{\"ok\": true}", ah.getResultJson());
        assertEquals("tester@ifpc.eu", ah.getUserEmail());
        assertNotNull(ah.getCreatedAt());
    }

    @Test
    @DisplayName("HelpText entity lifecycle and methods")
    void testHelpText() {
        HelpText ht = HelpText.builder()
                .id(1L)
                .textKey("help.pastorisation")
                .content("Guide d'utilisation...")
                .build();

        ht.onUpdate();
        assertEquals(1L, ht.getId());
        assertEquals("help.pastorisation", ht.getTextKey());
        assertEquals("Guide d'utilisation...", ht.getContent());
        assertNotNull(ht.getUpdatedAt());
    }

    @Test
    @DisplayName("Role Enum values")
    void testRoleEnum() {
        Role[] roles = Role.values();
        assertEquals(4, roles.length);
        assertEquals(Role.PENDING, Role.valueOf("PENDING"));
        assertEquals(Role.USER, Role.valueOf("USER"));
        assertEquals(Role.EXPERT, Role.valueOf("EXPERT"));
        assertEquals(Role.ADMIN, Role.valueOf("ADMIN"));
    }
}
