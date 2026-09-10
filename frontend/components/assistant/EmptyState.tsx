"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles } from "lucide-react";

/**
 * Écran d'accueil : ce que l'assistant sait faire, montré plutôt qu'expliqué.
 *
 * Les questions d'amorce viennent du service (`config/suggestions.json`) :
 * l'équipe IFPC les fait évoluer avec le corpus, sans passer par le front.
 */
export default function EmptyState({
  suggestions,
  onChoisir,
  fiches,
  compact = false,
}: {
  suggestions: string[];
  onChoisir: (question: string) => void;
  fiches: number;
  /** Dans la bulle flottante, la place se compte en pixels, pas en écrans. */
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 text-center ${
      compact ? "py-6" : "min-h-[70vh] py-12"}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`mb-4 flex items-center justify-center rounded-2xl bg-brand-primary/10
          text-brand-primary ${compact ? "h-10 w-10" : "h-14 w-14"}`}
      >
        <BookOpen className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
        className={`font-semibold tracking-tight text-brand-text ${
          compact ? "text-[16px]" : "text-[22px]"}`}
      >
        Que voulez-vous savoir ?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className={`mt-2 max-w-md leading-relaxed text-gray-500 ${
          compact ? "text-[12px]" : "text-[13.5px]"}`}
      >
        {compact
          ? "Posez votre question en langage courant : la réponse cite ses sources."
          : `Posez votre question en langage courant. La réponse est rédigée à partir du Livre de Connaissances AsCoCid${fiches ? ` — ${fiches} fiches` : ""}, avec ses sources et ses schémas.`}
      </motion.p>

      <div className={`grid w-full gap-2 ${
        compact ? "mt-5 max-w-none" : "mt-8 max-w-xl sm:grid-cols-2"}`}>
        {suggestions.slice(0, compact ? 3 : 4).map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 + i * 0.06, duration: 0.3 }}
            whileHover={{ y: -2 }}
            onClick={() => onChoisir(s)}
            className="group flex items-start gap-2.5 rounded-2xl border border-gray-100
              bg-white px-3.5 py-3 text-left transition-colors hover:border-brand-primary/30"
          >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300
              transition-colors group-hover:text-brand-primary" />
            <span className="text-[13px] leading-snug text-gray-600
              group-hover:text-brand-text">{s}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
