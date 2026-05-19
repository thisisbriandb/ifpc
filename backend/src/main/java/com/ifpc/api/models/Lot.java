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

    @Column(nullable = false, unique = true, length = 100)
    private String identifiant;

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
