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

/**
 * Temps de maintien mis en forme : une seule règle pour la jauge, les cartes
 * et la phrase d'interprétation.
 *
 * L'unité vient de la valeur et non du procédé — un maintien sous la minute
 * s'écrit en secondes qu'il sorte d'un flash ou d'une pasteurisation
 * classique. Sans cela, les cidres, dont le temps requis tombe à 0,01 s dès
 * 80 °C, s'affichaient « 0.0 min » : un zéro qui se lit comme « aucun
 * maintien nécessaire ». Sous la seconde, on affiche donc un plancher
 * explicite plutôt qu'un arrondi.
 */
export type HoldTimeDisplay = { value: string; unit: "sec" | "min" };

export function formatHoldTime(holdMin: number): HoldTimeDisplay {
  if (!Number.isFinite(holdMin) || holdMin <= 0) {
    return { value: "—", unit: "min" };
  }
  const holdSec = holdMin * 60;
  if (holdSec < 1) {
    return { value: "< 1", unit: "sec" };
  }
  if (holdMin < 1) {
    return { value: holdSec < 10 ? holdSec.toFixed(1) : Math.round(holdSec).toString(), unit: "sec" };
  }
  return { value: holdMin < 10 ? holdMin.toFixed(1) : Math.round(holdMin).toString(), unit: "min" };
}
