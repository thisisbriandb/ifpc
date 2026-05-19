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
@Table(name = "stockages")
public class Stockage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cuve_id", nullable = false)
    private Cuve cuve;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "lot_id", nullable = false)
    private Lot lot;

    @Column(nullable = false)
    private Double volumeOccupe;

    @Column(nullable = false)
    private LocalDateTime dateDebut;

    private LocalDateTime dateFin;

    @PrePersist
    protected void onCreate() {
        if (this.dateDebut == null) {
            this.dateDebut = LocalDateTime.now();
        }
    }
}
