package com.ifpc.api.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cuves")
public class Cuve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nom;

    // Locataire propriétaire de la cuve (adresse e-mail de l'utilisateur).
    @Column(name = "owner_email", length = 255)
    private String ownerEmail;

    @Column(nullable = false)
    private Double volumeMax;

    @Column(nullable = false)
    @Builder.Default
    private String statutPhysique = "PROPRE"; // PROPRE, SALE, EN_NETTOYAGE, EN_MAINTENANCE

    @Column(nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    private LocalDateTime deletedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "plan_x")
    private Double planX;

    @Column(name = "plan_y")
    private Double planY;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
