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
@Table(name = "analysis_history")
public class AnalysisHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Type d'analyse : "controle" ou "bareme"
    @Column(nullable = false)
    private String type;

    // Label descriptif (nom du fichier, "Données collées", etc.)
    @Column(nullable = false)
    private String label;

    // Résultat : "conforme", "vigilance", "insuffisant"
    private String statut;

    // VP obtenue
    private Double vp;

    // VP cible utilisée
    private Double vpCible;

    // Paramètres utilisés (JSON sérialisé)
    @Column(columnDefinition = "TEXT")
    private String parametres;

    // Données de courbe (JSON sérialisé) pour pouvoir ré-afficher les graphiques
    @Column(columnDefinition = "TEXT")
    private String courbe;

    // Résultat complet (JSON sérialisé) pour re-consultation
    @Column(columnDefinition = "TEXT")
    private String resultJson;

    // Utilisateur ayant lancé l'analyse (null si anonyme)
    private String userEmail;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
