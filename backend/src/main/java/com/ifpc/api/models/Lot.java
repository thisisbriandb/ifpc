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
@Table(name = "lots")
public class Lot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Unicité gérée par index composite (owner_email, identifiant) : deux
    // exploitations différentes peuvent nommer un lot de la même façon.
    @Column(nullable = false, length = 100)
    private String identifiant;

    // Locataire propriétaire du lot (adresse e-mail de l'utilisateur).
    @Column(name = "owner_email", length = 255)
    private String ownerEmail;

    @Column(nullable = false, length = 100)
    private String typeProduit;

    @Column(nullable = false)
    @Builder.Default
    private Double volumeActuel = 0.0;

    private Double colorL;
    private Double colorA;
    private Double colorB;
    private String colorHex;

    @Column(columnDefinition = "TEXT")
    private String spectrumJson;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String statutLot = "EN_FERMENTATION"; // EN_FERMENTATION, PRET_A_ASSEMBLER, EMBOUTEILLE

    @Column(nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    private LocalDateTime deletedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

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
