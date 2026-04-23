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

    @Column(nullable = false)
    private Double volumeMax;

    @Column(nullable = false)
    private Double volumeActuel;

    private String typeProduit; // e.g., "Jus de pomme", "Cidre doux"

    private String statut; // e.g., "Pleine", "En cours", "Vide", "En nettoyage"

    private String lotIdentifier;

    private Double colorL;
    private Double colorA;
    private Double colorB;
    private String colorHex;

    @Column(columnDefinition = "TEXT")
    private String spectrumJson;

    @Column
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
