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

    // N° lot ou identifiant produit saisi par l'utilisateur
    private String lotIdentifier;

    // Résultat : "conforme" ou "insuffisant"
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

    // Preuve que le verdict vient bien du moteur de calcul et non du poste
    // client : le jeton signé par le Calc Engine, conservé tel quel pour qu'un
    // contrôle ultérieur puisse le revérifier hors de l'application.
    @Column(columnDefinition = "TEXT")
    private String jetonResultat;

    // Identifiant du jeton, à usage unique : un même résultat de calcul ne peut
    // pas être archivé deux fois, ni rejoué sur un autre numéro de lot.
    @Column(name = "resultat_jti", unique = true, length = 64)
    private String resultatJti;

    // Vrai quand le verdict provient d'un jeton vérifié. Les analyses
    // antérieures à ce contrôle, et les types qui n'en produisent pas encore
    // (colorimétrie), restent à faux : la distinction doit rester lisible.
    @Column(nullable = false)
    @Builder.Default
    private Boolean scelle = false;

    // Suppression logique : une analyse retirée de l'historique doit rester
    // dans le registre. Une pièce de maîtrise sanitaire que l'on peut effacer
    // ne démontre rien — il suffirait de retirer les résultats gênants.
    @Column(nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    private LocalDateTime deletedAt;

    private String deletedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
