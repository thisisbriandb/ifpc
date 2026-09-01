import type { UniteTemps } from "./api";

/**
 * Procédé et unité de temps décrivent la même réalité sous deux angles : une
 * flash-pasteurisation se relève en secondes, les autres procédés en minutes.
 *
 * Les deux contrôles de l'interface sont liés dans les deux sens à l'aide de
 * ces fonctions, de sorte qu'aucune combinaison incohérente ne soit
 * atteignable — se tromper d'unité fausse la VP d'un facteur 60.
 */
const UNITE_PAR_PROCEDE: Record<string, UniteTemps> = {
  flash: "seconde",
  classique: "minute",
  tunnel: "minute",
};

const PROCEDE_PAR_UNITE: Record<UniteTemps, string> = {
  seconde: "flash",
  minute: "classique",
};

/** Unité attendue pour un procédé donné. */
export function uniteDuProcede(procede: string): UniteTemps {
  return UNITE_PAR_PROCEDE[procede] ?? "minute";
}

/**
 * Procédé à retenir quand l'utilisateur choisit une unité : on ne change que
 * si le procédé courant est incompatible, pour ne pas écraser un choix
 * légitime (« tunnel » reste « tunnel » quand on confirme « minute »).
 */
export function procedeAccorde(procedeActuel: string, unite: UniteTemps): string {
  return uniteDuProcede(procedeActuel) === unite ? procedeActuel : PROCEDE_PAR_UNITE[unite];
}
