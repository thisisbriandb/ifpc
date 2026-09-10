/**
 * Couleur d'accent par section de la plateforme.
 *
 * Une page appartient à un domaine, et ce domaine a une couleur — la même que
 * sur la couronne du tableau de bord. Elle marque l'élément actif de la barre
 * latérale : son libellé et son indicateur la portent.
 *
 * Elle a un temps servi aussi à teinter la frontière barre / page. Les deux
 * tentatives — une nappe radiale, puis une traînée horizontale — gênaient la
 * lecture du contenu ; la couleur reste donc dans la barre.
 *
 * Fonction pure : c'est la table de correspondance, elle se teste seule.
 */

export interface Accent {
  /** Identifiant de section — sert de clé d'animation au changement de page. */
  cle: string;
  /** Couleur pleine, pour l'indicateur et le texte actif. */
  couleur: string;
}

const NEUTRE: Accent = { cle: "neutre", couleur: "#628d17" };

/** Du plus spécifique au plus général : la première entrée qui préfixe gagne. */
const SECTIONS: { prefixes: string[]; accent: Accent }[] = [
  {
    prefixes: ["/controle", "/bareme"],
    accent: { cle: "pasteurisation", couleur: "#628d17" },
  },
  {
    prefixes: ["/colorimetrie"],
    accent: { cle: "colorimetrie", couleur: "#ee8c00" },
  },
  {
    prefixes: ["/cuves", "/lots"],
    accent: { cle: "cuves", couleur: "#67a5db" },
  },
  {
    prefixes: ["/assistant"],
    accent: { cle: "assistant", couleur: "#628d17" },
  },
  {
    // Administration : un rouge discret, cohérent avec l'entrée de la barre.
    prefixes: ["/admin", "/expert"],
    accent: { cle: "admin", couleur: "#C62828" },
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
