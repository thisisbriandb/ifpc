/**
 * Glyphes propres à la filière cidricole.
 *
 * Les icônes génériques d'une bibliothèque (un thermomètre, une palette, un
 * carton) ne disent rien du métier : elles pourraient illustrer n'importe quel
 * logiciel. Celles-ci représentent ce que l'utilisateur manipule réellement —
 * une sonde plongée dans un moût, un verre de cidre à juger, une cuve avec son
 * niveau et sa vanne.
 *
 * Dessin aligné sur le logo IFPC : trait de 1,5 sur une grille de 24,
 * terminaisons et jointures arrondies, aucune surface pleine. La couleur vient
 * de `currentColor` — le glyphe prend celle de son intertitre.
 */

interface ProprietesGlyphe {
  className?: string;
}

const COMMUN = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/**
 * Thermomètre fermé : tube et bulbe d'un seul trait, deux graduations.
 *
 * Deux essais écartés : une tige nue traversant une ligne d'eau se lisait
 * comme une antenne, et les vagues n'ajoutaient que du bruit à 18 px. Un
 * contour continu est ce qui donne la silhouette.
 */
export function GlypheePasteurisation({ className }: ProprietesGlyphe) {
  return (
    <svg {...COMMUN} className={className}>
      <path d="M13.6 13.9V5.1a1.6 1.6 0 0 0-3.2 0v8.8a3.6 3.6 0 1 0 3.2 0Z" />
      <path d="M15.6 7.6h2.2" />
      <path d="M15.6 10.6h2.2" />
    </svg>
  );
}

/** Verre de dégustation, avec le niveau du cidre : la couleur se juge au verre. */
export function GlypheeColorimetrie({ className }: ProprietesGlyphe) {
  return (
    <svg {...COMMUN} className={className}>
      <path d="M7.6 3.5h8.8c0 5.2-1.6 8.4-4.4 9-2.8-.6-4.4-3.8-4.4-9Z" />
      <path d="M8.1 7.5h7.8" />
      <path d="M12 12.5v6" />
      <path d="M8.6 20.5h6.8" />
    </svg>
  );
}

/**
 * Cuve de chai : corps droit, fond conique, pieds et vanne de soutirage.
 *
 * Le fond conique est ce qui distingue la cuve du cylindre à ellipse — lequel
 * est, trait pour trait, le symbole universel de la base de données. Les pieds
 * et la vanne achèvent de la situer dans un chai.
 */
export function GlypheeCuve({ className }: ProprietesGlyphe) {
  return (
    <svg {...COMMUN} className={className}>
      <path d="M6.4 4.5h11.2v11.2l-2.4 3.8H8.8l-2.4-3.8Z" />
      <path d="M6.4 10.5h11.2" />
      <path d="M17.6 13.2h2.2" />
      <path d="M9.6 19.5v2" />
      <path d="M14.4 19.5v2" />
    </svg>
  );
}
