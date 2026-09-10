"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { accentDe } from "@/lib/accents";
import { useSidebar } from "@/lib/sidebar-context";

/**
 * Nappe colorée à la frontière barre latérale / page.
 *
 * Le principe n'est pas de teinter une surface mais de **relier les deux** :
 * un halo large, très flou, centré sur la couture verticale, déborde des deux
 * côtés. La barre latérale garde son fond blanc — la couleur s'y mélange, elle
 * ne le remplace pas.
 *
 * Le halo se cale sur la hauteur de l'élément de menu actif, mesuré dans le
 * DOM (`[data-actif]`). Changer de page le fait donc **glisser** vers la
 * nouvelle sélection, avec un ressort lent : c'est ce déplacement, et non une
 * transition de couleur, qui donne la sensation que les deux surfaces
 * appartiennent au même écran.
 *
 * Trois contraintes techniques :
 *   * les pages peignent un fond opaque : le halo passe donc au-dessus d'elles
 *     — et au-dessus de la barre (z-70), sans quoi il s'arrêterait à la
 *     couture au lieu de la traverser ;
 *   * `mix-blend-multiply` évite de délaver le texte : multiplier un texte
 *     presque noir par une couleur claire ne le change pas, alors que les
 *     surfaces claires prennent la teinte ;
 *   * `pointer-events-none`, évidemment : rien ne doit devenir incliquable.
 */

const LARGEUR_HALO = 620;
const HAUTEUR_HALO = 520;

export default function TeinteSection() {
  const chemin = usePathname() ?? "/";
  const { collapsed } = useSidebar();
  const mouvementReduit = useReducedMotion();
  const accent = accentDe(chemin);

  const [ancre, setAncre] = useState<{ y: number; x: number } | null>(null);

  const mesurer = useCallback(() => {
    if (typeof window === "undefined") return;
    const barre = document.querySelector("aside");
    const actif = document.querySelector<HTMLElement>("aside [data-actif='true']");
    const bordBarre = barre ? barre.getBoundingClientRect().right : 0;
    const cible = actif?.getBoundingClientRect();
    setAncre({
      x: bordBarre,
      // Sans élément actif marqué, le halo se pose au tiers supérieur plutôt
      // que de disparaître : la couture reste vivante.
      y: cible ? cible.top + cible.height / 2 : window.innerHeight * 0.32,
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

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[65] mix-blend-multiply"
      style={{ width: LARGEUR_HALO, height: HAUTEUR_HALO, filter: "blur(56px)" }}
      animate={{ x: ancre.x - LARGEUR_HALO * 0.42, y: ancre.y - HAUTEUR_HALO / 2 }}
      transition={
        mouvementReduit
          ? { duration: 0 }
          // Ressort lent et amorti : la nappe se déplace, elle ne saute pas.
          : { type: "spring", stiffness: 42, damping: 18, mass: 1.4 }
      }
    >
      <AnimatePresence>
        <motion.div
          key={accent.cle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: mouvementReduit ? 0 : 1.1, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(50% 50% at 50% 50%, ${accent.voile}, transparent 72%)`,
          }}
        />
      </AnimatePresence>
    </motion.div>
  );
}
