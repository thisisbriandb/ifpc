"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { accentDe } from "@/lib/accents";
import { useSidebar } from "@/lib/sidebar-context";

/**
 * Diffusion horizontale depuis l'élément de menu actif.
 *
 * L'élément actif de la barre latérale « déteint » vers la droite : une traînée
 * de sa hauteur part de son bord, franchit la couture et s'éteint quelques
 * centaines de pixels plus loin dans la page. C'est ce franchissement qui relie
 * « où je suis dans le menu » et « ce que je regarde ».
 *
 * Contraintes de lisibilité, apprises d'une première version trop ambitieuse
 * — une nappe radiale de 620 × 520 px posée sur toute la zone de contenu :
 *
 *   * la traînée reste **de la hauteur de l'élément**, pas de celle de l'écran.
 *     Elle ne recouvre donc qu'une ligne de la page, jamais un paragraphe ;
 *   * elle s'éteint en moins de 300 px, avant d'atteindre le corps du contenu ;
 *   * `mix-blend-multiply` est conservé : multiplier un texte presque noir par
 *     une couleur claire ne le change pas, alors qu'un voile en alpha normal
 *     l'éclaircirait et lui ferait perdre du contraste ;
 *   * `pointer-events-none` : rien ne devient incliquable.
 *
 * La traînée se cale sur l'élément marqué `[data-actif]` et **glisse** vers la
 * nouvelle sélection au changement de page — c'est le déplacement, plus que la
 * couleur, qui fait le lien.
 */

/** Portée de la diffusion vers la droite, au-delà de la couture. */
const PORTEE = 280;
/** Amorce à gauche de la couture, pour que la traînée parte bien de l'élément. */
const AMORCE = 28;
/** Débord vertical de part et d'autre de l'élément, pour adoucir les bords. */
const DEBORD = 10;

interface Ancre {
  x: number;
  y: number;
  hauteur: number;
}

export default function TeinteSection() {
  const chemin = usePathname() ?? "/";
  const { collapsed } = useSidebar();
  const mouvementReduit = useReducedMotion();
  const accent = accentDe(chemin);

  const [ancre, setAncre] = useState<Ancre | null>(null);

  const mesurer = useCallback(() => {
    if (typeof window === "undefined") return;
    const barre = document.querySelector("aside");
    const actif = document.querySelector<HTMLElement>("aside [data-actif='true']");
    if (!barre || !actif) {
      // Sans élément actif marqué, aucune traînée : mieux vaut rien qu'un
      // trait posé au hasard.
      setAncre(null);
      return;
    }
    const cible = actif.getBoundingClientRect();
    setAncre({
      x: barre.getBoundingClientRect().right,
      y: cible.top,
      hauteur: cible.height,
    });
  }, []);

  useEffect(() => {
    // Deux mesures : l'une immédiate, l'autre après l'ouverture du groupe de
    // menu, qui déplace l'élément actif de quelques dizaines de pixels.
    mesurer();
    const differee = window.setTimeout(mesurer, 320);
    window.addEventListener("resize", mesurer);
    return () => {
      window.clearTimeout(differee);
      window.removeEventListener("resize", mesurer);
    };
  }, [chemin, collapsed, mesurer]);

  if (chemin === "/login" || !ancre) return null;

  const hauteur = ancre.hauteur + DEBORD * 2;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[65] mix-blend-multiply"
      style={{ width: AMORCE + PORTEE, height: hauteur, filter: "blur(14px)" }}
      animate={{ x: ancre.x - AMORCE, y: ancre.y - DEBORD }}
      transition={
        mouvementReduit
          ? { duration: 0 }
          // Ressort lent et amorti : la traînée se déplace, elle ne saute pas.
          : { type: "spring", stiffness: 60, damping: 20, mass: 1.1 }
      }
    >
      <motion.div
        key={accent.cle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: mouvementReduit ? 0 : 0.6, ease: "easeOut" }}
        className="absolute inset-0"
        style={{
          // Pleine teinte à l'amorce, extinction complète bien avant le contenu.
          background: `linear-gradient(to right, ${accent.voile} 0%, ${accent.voile} 12%, transparent 100%)`,
          // Les bords haut et bas s'estompent : la traînée n'a pas de coin.
          maskImage: "linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)",
        }}
      />
    </motion.div>
  );
}
