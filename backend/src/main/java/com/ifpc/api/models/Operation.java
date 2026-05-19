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
@Table(name = "operations")
public class Operation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String type; // NETTOYAGE, REMPLISSAGE, TRANSFERT, TRANSFORMATION, ASSEMBLAGE

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cuve_source_id")
    private Cuve cuveSource;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cuve_dest_id")
    private Cuve cuveDest;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "lot_id")
    private Lot lot;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "lot_resultat_id")
    private Lot lotResultat;

    private Double volume;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String userEmail;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
