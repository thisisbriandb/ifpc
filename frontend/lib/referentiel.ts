/**
 * Référentiel scientifique — copie côté client.
 *
 * Ces valeurs doivent correspondre exactement au document
 * `referentiel-scientifique.md` §4, qui fait autorité. La correspondance est
 * vérifiée automatiquement par `__tests__/lib/referentiel.test.ts`, qui lit le
 * document lui-même : modifier un paramètre scientifique ici sans le modifier
 * là-bas fait échouer l'intégration continue, et inversement.
 *
 * Cette copie existe parce que l'aide au choix du barème calcule entièrement
 * côté client, sans appel au moteur. L'étape suivante serait de la servir par
 * `/api/referentiels/microorganismes`, qui existe déjà : la duplication
 * disparaîtrait au lieu d'être seulement surveillée.
 */

export interface MicroorganismeRef {
  nom: string;
  t_ref: number;
  z: number;
  d_ref: number;
  vp_cible: number;
}

export const MICROORGANISMES: Record<string, MicroorganismeRef> = {
  alicyclo_std:       { nom: "Alicyclobacillus acidoterrestris", t_ref: 95, z: 16.4, d_ref: 27.8,  vp_cible: 417.0 },
  ecoli:              { nom: "Escherichia coli",                 t_ref: 62, z: 6.0,  d_ref: 1.5,   vp_cible: 22.5  },
  salmonella:         { nom: "Salmonella",                       t_ref: 62, z: 6.0,  d_ref: 0.49,  vp_cible: 7.35  },
  listeria:           { nom: "Listeria monocytogenes",           t_ref: 62, z: 5.6,  d_ref: 0.43,  vp_cible: 6.45  },
  byssochlamys_fulva: { nom: "Byssochlamys fulva",               t_ref: 95, z: 7.1,  d_ref: 1.81,  vp_cible: 27.15 },
  saccharo_jus:       { nom: "Saccharomyces cerevisiae",         t_ref: 60, z: 4.0,  d_ref: 22.5,  vp_cible: 337.5 },
  saccharo_cidre:     { nom: "Saccharomyces cerevisiae 1",       t_ref: 60, z: 4.0,  d_ref: 1.1,   vp_cible: 16.5  },
  saccharo_cidre_low: { nom: "Saccharomyces cerevisiae 2",       t_ref: 60, z: 4.0,  d_ref: 0.4,   vp_cible: 6.0   },
};

export interface ProduitRef {
  nom: string;
  micro: string;
  vp_cible: number;
}

// Trois types de produit : doux/demi-sec et brut/extra-brut partagent leur
// microorganisme de référence et leur VP cible, ils ne font plus qu'une entrée.
export const PRODUITS: Record<string, ProduitRef> = {
  jus_pomme:  { nom: "Jus de pomme",             micro: "byssochlamys_fulva", vp_cible: 27.15 },
  cidre_doux: { nom: "Cidre doux et demi-sec",   micro: "saccharo_cidre",     vp_cible: 16.5  },
  cidre_brut: { nom: "Cidre brut et extra-brut", micro: "saccharo_cidre_low", vp_cible: 6.0   },
};

// Types supprimés par le regroupement, encore portés par des analyses enregistrées
export const ALIAS_PRODUITS: Record<string, string> = {
  cidre_demi_sec: "cidre_doux",
  cidre_extra_brut: "cidre_brut",
};

export const normaliserProduit = (type: string) => ALIAS_PRODUITS[type] ?? type;

// « alicyclo_res » a été retirée du référentiel : doublon strict d'« alicyclo_std »
// sans correspondance dans le tableau transmis par la R&D. La clé reste acceptée
// pour que les analyses enregistrées qui la portent restent relisibles.
export const ALIAS_MICROORGANISMES: Record<string, string> = {
  alicyclo_res: "alicyclo_std",
};

export const normaliserMicroorganisme = (cle: string) => ALIAS_MICROORGANISMES[cle] ?? cle;

/**
 * Cibles proposées en mode expert (référentiel §4.3).
 *
 * La première de chaque liste est la cible du mode classique. Pour le jus de
 * pomme, les quatre premières sont celles que le moteur évalue en parallèle.
 */
export const PRODUCT_MICROS: Record<string, string[]> = {
  jus_pomme:  ["byssochlamys_fulva", "alicyclo_std", "saccharo_jus", "ecoli", "salmonella", "listeria"],
  cidre_doux: ["saccharo_cidre", "ecoli", "salmonella"],
  // Brut et extra-brut ont pour référence Sacch. cer. 2, pas la souche du doux
  cidre_brut: ["saccharo_cidre_low", "ecoli", "salmonella"],
};
