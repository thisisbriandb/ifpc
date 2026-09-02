package com.ifpc.api.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Journal des opérations sensibles.
 *
 * <p>Trace ce qui, sans elle, ne laisserait aucune marque : la suppression
 * d'une analyse, un changement de rôle, la modification d'une VP cible, la
 * suppression d'un compte. Ces opérations touchent soit le registre de
 * maîtrise sanitaire, soit les paramètres qui le gouvernent, soit les droits
 * d'y accéder.</p>
 *
 * <p>Le journal est en <b>ajout seul</b> : aucun point d'entrée de
 * l'application ne le modifie ni ne l'efface. Un journal que l'on peut élaguer
 * ne prouve rien de plus que l'absence de journal.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "audit_log", indexes = {
        @Index(name = "idx_audit_log_created", columnList = "createdAt"),
        @Index(name = "idx_audit_log_acteur", columnList = "acteurEmail"),
})
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nature de l'opération, cf. {@link AuditAction}. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AuditAction action;

    /** Type d'objet touché : « analyse », « utilisateur », « configuration produit ». */
    @Column(nullable = false, length = 40)
    private String cibleType;

    /** Identifiant de l'objet touché, sous forme lisible. */
    @Column(length = 255)
    private String cibleId;

    /** Qui a agi. Null seulement si l'opération vient du système lui-même. */
    @Column(length = 255)
    private String acteurEmail;

    /** Contexte de l'opération : valeurs avant / après, motif. JSON sérialisé. */
    @Column(columnDefinition = "TEXT")
    private String details;

    /**
     * Instant de l'opération, en UTC.
     *
     * <p>{@code Instant} et non {@code LocalDateTime} : une entrée de journal
     * doit être datée sans ambiguïté, y compris au changement d'heure ou si
     * l'hébergement change de région.</p>
     */
    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }
}
