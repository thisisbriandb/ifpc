package com.ifpc.api.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ifpc.api.models.*;
import com.ifpc.api.repositories.AnalysisHistoryRepository;
import com.ifpc.api.repositories.AuditLogRepository;
import com.ifpc.api.repositories.HelpTextRepository;
import com.ifpc.api.repositories.ProductConfigRepository;
import com.ifpc.api.repositories.UserRepository;
import com.ifpc.api.security.JwtService;
import com.ifpc.api.services.AuditService;
import com.ifpc.api.services.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Traçabilité des opérations sensibles.
 *
 * <p>Le défaut d'origine : une analyse se supprimait physiquement, sans trace,
 * et rien n'était journalisé — ni les suppressions, ni les changements de
 * rôle, ni les modifications de VP cible, ni les suppressions de comptes. Un
 * registre où l'on peut retirer les résultats gênants ne démontre rien, et un
 * paramètre de sécurité sanitaire modifiable sans trace non plus.</p>
 */
@ExtendWith(MockitoExtension.class)
class TracabiliteOperationsTest {

    @Mock private AnalysisHistoryRepository historyRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private UserRepository userRepository;
    @Mock private ProductConfigRepository productConfigRepository;
    @Mock private HelpTextRepository helpTextRepository;
    @Mock private EmailService emailService;
    @Mock private JwtService jwtService;

    private AuditService auditService;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        User admin = User.builder().email("admin@ifpc.eu").role(Role.ADMIN).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
        auditService = new AuditService(auditLogRepository, new ObjectMapper());
    }

    private AuditLog capturerJournal() {
        ArgumentCaptor<AuditLog> capture = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(capture.capture());
        return capture.getValue();
    }

    // ── Suppression logique des analyses ────────────────────────────────

    @Nested
    @DisplayName("suppression d'une analyse")
    class SuppressionAnalyse {

        private HistoryController controller() {
            return new HistoryController(historyRepository, jwtService, new ObjectMapper(), auditService);
        }

        private AnalysisHistory analyse() {
            return AnalysisHistory.builder()
                    .id(7L).userEmail("tech@ifpc.eu").statut("insuffisant")
                    .lotIdentifier("LOT-2026-114").scelle(true)
                    .createdAt(LocalDateTime.now()).deleted(false)
                    .build();
        }

        @BeforeEach
        void seConnecterCommeTechnicien() {
            User user = User.builder().email("tech@ifpc.eu").role(Role.USER).build();
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        }

        @Test
        @DisplayName("l'analyse est marquée, jamais retirée de la base")
        void laSuppressionEstLogique() {
            AnalysisHistory analyse = analyse();
            when(historyRepository.findByIdAndUserEmailAndDeletedFalse(7L, "tech@ifpc.eu"))
                    .thenReturn(Optional.of(analyse));

            controller().deleteAnalysis(7L);

            verify(historyRepository, never()).delete(any());
            verify(historyRepository).save(analyse);
            assertTrue(analyse.getDeleted());
        }

        @Test
        @DisplayName("qui a supprimé, et quand")
        void laSuppressionEstAttribuee() {
            AnalysisHistory analyse = analyse();
            when(historyRepository.findByIdAndUserEmailAndDeletedFalse(7L, "tech@ifpc.eu"))
                    .thenReturn(Optional.of(analyse));

            controller().deleteAnalysis(7L);

            assertEquals("tech@ifpc.eu", analyse.getDeletedBy());
            assertNotNull(analyse.getDeletedAt());
        }

        @Test
        @DisplayName("la suppression est consignée au journal, avec le verdict retiré")
        void laSuppressionEstConsignee() {
            when(historyRepository.findByIdAndUserEmailAndDeletedFalse(7L, "tech@ifpc.eu"))
                    .thenReturn(Optional.of(analyse()));

            controller().deleteAnalysis(7L);

            AuditLog entree = capturerJournal();
            assertEquals(AuditAction.ANALYSE_SUPPRIMEE, entree.getAction());
            assertEquals("analyse", entree.getCibleType());
            assertEquals("7", entree.getCibleId());
            assertEquals("tech@ifpc.eu", entree.getActeurEmail());
            // Le verdict retiré doit rester lisible dans le journal : c'est
            // l'information qu'un effacement ferait disparaître.
            assertTrue(entree.getDetails().contains("insuffisant"));
            assertTrue(entree.getDetails().contains("LOT-2026-114"));
        }

        @Test
        @DisplayName("une analyse déjà supprimée n'est plus atteignable")
        void uneAnalyseSupprimeeEstInvisible() {
            when(historyRepository.findByIdAndUserEmailAndDeletedFalse(7L, "tech@ifpc.eu"))
                    .thenReturn(Optional.empty());

            assertEquals(404, controller().deleteAnalysis(7L).getStatusCode().value());
            assertEquals(404, controller().getAnalysis(7L).getStatusCode().value());
        }
    }

    // ── Journal des opérations d'administration ─────────────────────────

    @Nested
    @DisplayName("opérations d'administration")
    class Administration {

        private AdminController controller() {
            return new AdminController(userRepository, productConfigRepository, helpTextRepository,
                    emailService, auditService, auditLogRepository);
        }

        @Test
        @DisplayName("un changement de rôle consigne l'ancien et le nouveau")
        void leChangementDeRoleEstConsigne() {
            User user = User.builder().id(3L).email("tech@ifpc.eu").role(Role.USER).build();
            when(userRepository.findById(3L)).thenReturn(Optional.of(user));

            controller().updateUserRole(3L, new AdminController.RoleUpdateRequest("EXPERT"));

            AuditLog entree = capturerJournal();
            assertEquals(AuditAction.ROLE_MODIFIE, entree.getAction());
            assertEquals("tech@ifpc.eu", entree.getCibleId());
            assertEquals("admin@ifpc.eu", entree.getActeurEmail());
            assertTrue(entree.getDetails().contains("USER"));
            assertTrue(entree.getDetails().contains("EXPERT"));
        }

        @Test
        @DisplayName("une modification de VP cible consigne la valeur antérieure")
        void laModificationDeVpCibleEstConsignee() {
            ProductConfig config = ProductConfig.builder()
                    .id(1L).productType("cidre_doux").productName("Cidre doux").vpCible(16.5).build();
            when(productConfigRepository.findByProductType("cidre_doux")).thenReturn(Optional.of(config));

            controller().upsertProductConfig("cidre_doux",
                    new AdminController.ProductConfigUpdateRequest(30.0, null));

            AuditLog entree = capturerJournal();
            assertEquals(AuditAction.VP_CIBLE_MODIFIEE, entree.getAction());
            assertEquals("configuration produit", entree.getCibleType());
            assertEquals("cidre_doux", entree.getCibleId());
            assertTrue(entree.getDetails().contains("16.5"), "la valeur d'avant doit rester lisible");
            assertTrue(entree.getDetails().contains("30.0"));
        }

        @Test
        @DisplayName("la suppression d'un compte est consignée")
        void laSuppressionDeCompteEstConsignee() {
            User user = User.builder().id(4L).email("parti@ifpc.eu").role(Role.USER).build();
            when(userRepository.findById(4L)).thenReturn(Optional.of(user));

            controller().deleteUser(4L, SecurityContextHolder.getContext().getAuthentication());

            AuditLog entree = capturerJournal();
            assertEquals(AuditAction.COMPTE_SUPPRIME, entree.getAction());
            assertEquals("parti@ifpc.eu", entree.getCibleId());
        }

        @Test
        @DisplayName("une approbation de compte est consignée")
        void lApprobationEstConsignee() {
            User user = User.builder().id(5L).email("nouveau@ifpc.eu").role(Role.PENDING).build();
            when(userRepository.findById(5L)).thenReturn(Optional.of(user));

            controller().approveUser(5L);

            AuditLog entree = capturerJournal();
            assertEquals(AuditAction.COMPTE_APPROUVE, entree.getAction());
            assertTrue(entree.getDetails().contains("PENDING"));
        }
    }

    // ── Propriétés du journal lui-même ──────────────────────────────────

    @Nested
    @DisplayName("le journal")
    class Journal {

        @Test
        @DisplayName("chaque entrée est datée en UTC")
        void chaqueEntreeEstDateeEnUtc() {
            Instant avant = Instant.now().minusSeconds(1);
            auditService.consigner(AuditAction.ROLE_MODIFIE, "utilisateur", "x@ifpc.eu", Map.of());

            AuditLog entree = capturerJournal();
            assertNotNull(entree.getCreatedAt());
            assertTrue(entree.getCreatedAt().isAfter(avant));
        }

        @Test
        @DisplayName("l'acteur vient du contexte de sécurité, jamais de l'appelant")
        void lActeurNEstPasFourniParLAppelant() {
            auditService.consigner(AuditAction.ROLE_MODIFIE, "utilisateur", "x@ifpc.eu",
                    Map.of("acteurEmail", "quelquun.dautre@ifpc.eu"));

            assertEquals("admin@ifpc.eu", capturerJournal().getActeurEmail());
        }

        @Test
        @DisplayName("une panne du journal ne fait pas échouer l'opération journalisée")
        void unePanneDuJournalNeBloquePas() {
            when(auditLogRepository.save(any(AuditLog.class)))
                    .thenThrow(new RuntimeException("base indisponible"));

            assertDoesNotThrow(() -> auditService.consigner(
                    AuditAction.ANALYSE_SUPPRIMEE, "analyse", "1", Map.of()));
        }
    }
}
