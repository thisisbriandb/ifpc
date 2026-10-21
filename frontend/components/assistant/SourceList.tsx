"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import type { SourceLdc } from "@/lib/ldc";

/**
 * Les passages retenus, sous la réponse.
 *
 * Deux exigences opposées : la réponse d'abord (spec 07 §1), mais aucune
 * affirmation sans référence vérifiable. D'où la liste repliée par défaut, et
 * la citation cliquable dans le texte qui l'ouvre sur la bonne entrée.
 *
 * `surligne` porte le numéro cliqué depuis le texte : la carte correspondante
 * change de couleur le temps qu'on la retrouve des yeux.
 */
export default function SourceList({
  sources: toutes,
  cites,
  surligne,
  onOuvrir,
}: {
  sources: SourceLdc[];
  /**
   * Numéros cités par la réponse. Seules ces sources sont listées : les autres
   * passages ont été lus par le modèle sans lui servir, les présenter comme
   * « sources » serait trompeur. Ils restent consultables, repliés.
   */
  cites?: number[];
  surligne: number | null;
  onOuvrir: (source: SourceLdc) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [autresOuverts, setAutresOuverts] = useState(false);
  if (!toutes.length) return null;
  const parNumero = new Map(toutes.map((s) => [s.index, s]));
  const sources = cites
    ? cites.map((n) => parNumero.get(n)).filter((s): s is SourceLdc => !!s)
    : toutes;
  const autres = cites ? toutes.filter((s) => !cites.includes(s.index)) : [];
  // « du Livre » n'est vrai que si toutes les sources viennent d'AsCoCid.
  const toutesDuLivre = sources.every((s) => s.provenance !== "document");
  const libelle = sources.length
    ? `${sources.length} source${sources.length > 1 ? "s" : ""}${cites ? ` citée${sources.length > 1 ? "s" : ""}` : ""}${toutesDuLivre ? " du Livre" : ""}`
    : `${autres.length} passage${autres.length > 1 ? "s" : ""} consulté${autres.length > 1 ? "s" : ""}, aucun cité`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4"
    >
      <button
        onClick={() => setOuvert((v) => !v)}
        className="group flex items-center gap-1.5 text-[12px] font-medium text-gray-500
          transition-colors hover:text-brand-primary"
      >
        <BookOpen className="h-3.5 w-3.5" />
        {libelle}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mt-2 space-y-1.5 overflow-hidden"
          >
            {(sources.length ? sources : autres).map((s, i) => (
              <CarteSource key={s.index} source={s} rang={i} surligne={surligne} onOuvrir={onOuvrir} />
            ))}
            {sources.length > 0 && autres.length > 0 && (
              <li>
                <button onClick={() => setAutresOuverts((v) => !v)}
                  className="mt-1 text-[11px] text-gray-400 hover:text-brand-primary">
                  {autresOuverts ? "Masquer" : "Voir"}{" "}
                  {autres.length > 1
                    ? `les ${autres.length} autres passages consultés, non cités`
                    : "l'autre passage consulté, non cité"}
                </button>
              </li>
            )}
            {autresOuverts && sources.length > 0 && autres.map((s, i) => (
              <CarteSource key={s.index} source={s} rang={i} surligne={surligne} onOuvrir={onOuvrir} discrete />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CarteSource({
  source, rang, surligne, onOuvrir, discrete = false,
}: {
  source: SourceLdc;
  rang: number;
  surligne: number | null;
  onOuvrir: (source: SourceLdc) => void;
  /** Passage consulté sans être cité : présenté en retrait. */
  discrete?: boolean;
}) {
  return (
    <motion.li
      id={`source-${source.index}`}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: discrete ? 0.6 : 1, x: 0 }}
      transition={{ delay: rang * 0.03, duration: 0.2 }}
    >
      <button
        onClick={() => onOuvrir(source)}
        className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left
          transition-colors ${
            surligne === source.index
              ? "border-brand-primary/40 bg-brand-primary/5"
              : "border-gray-100 bg-white hover:border-brand-primary/30 hover:bg-brand-gray"
          }`}
      >
        <span
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded
            bg-brand-primary/10 text-[10px] font-semibold text-brand-primary"
        >
          {source.index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-brand-text">
            <span className="truncate">{source.titre_fiche}</span>
            {source.provenance === "document" && (
              <span className="shrink-0 rounded bg-amber-50 px-1.5 py-px text-[10px]
                font-semibold text-amber-700">
                Document IFPC
              </span>
            )}
          </span>
          {(source.titre_section || source.terme) && (
            <span className="block truncate text-[11px] text-gray-400">
              {source.titre_section || `définition de « ${source.terme} »`}
            </span>
          )}
        </span>
        <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-gray-300" />
      </button>
    </motion.li>
  );
}
