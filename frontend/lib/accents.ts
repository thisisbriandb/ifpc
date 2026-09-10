/**
 * Couleur d'accent par section de la plateforme.
 *
 * Une page appartient à un domaine, et ce domaine a une couleur — la même que
 * sur la couronne du tableau de bord. Elle sert deux fois : l'élément actif de
 * la barre latérale la porte, et le fond de la page en reçoit un voile. C'est
 * ce qui relie visuellement « où je suis dans le menu » et « où je suis ».
 *
 * Fonction pure : c'est la table de correspondance, elle se teste seule.
 */

export interface Accent {
  /** Identifiant de section — sert de clé d'animation au changement de page. */
  cle: string;
  /** Couleur pleine, pour l'indicateur et le texte actif. */
  couleur: string;
  /** La même, très diluée : le voile de fond. */
  voile: string;
}

const NEUTRE: Accent = { cle: "neutre", couleur: "#628d17", voile: "rgba(98,141,23,0)" };

/** Du plus spécifique au plus général : la première entrée qui préfixe gagne. */
const SECTIONS: { prefixes: string[]; accent: Accent }[] = [
  {
    prefixes: ["/controle", "/bareme"],
    accent: { cle: "pasteurisation", couleur: "#628d17", voile: "rgba(98,141,23,0.30)" },
  },
  {
    prefixes: ["/colorimetrie"],
    accent: { cle: "colorimetrie", couleur: "#ee8c00", voile: "rgba(238,140,0,0.27)" },
  },
  {
    prefixes: ["/cuves", "/lots"],
    accent: { cle: "cuves", couleur: "#67a5db", voile: "rgba(103,165,219,0.34)" },
  },
  {
    prefixes: ["/assistant"],
    accent: { cle: "assistant", couleur: "#628d17", voile: "rgba(98,141,23,0.22)" },
  },
  {
    // Administration : un rouge discret, cohérent avec l'entrée de la barre.
    prefixes: ["/admin", "/expert"],
    accent: { cle: "admin", couleur: "#C62828", voile: "rgba(198,40,40,0.18)" },
  },
];

export function accentDe(chemin: string): Accent {
  const propre = chemin.split("?")[0].replace(/\/+$/, "") || "/";
  for (const section of SECTIONS) {
    if (section.prefixes.some((p) => propre === p || propre.startsWith(`${p}/`))) {
      return section.accent;
    }
  }
  return NEUTRE;
}
