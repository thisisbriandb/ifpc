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
}: {
  suggestions: string[];
  onChoisir: (question: string) => void;
  fiches: number;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl
          bg-brand-primary/10 text-brand-primary"
      >
        <BookOpen className="h-6 w-6" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
        className="text-[22px] font-semibold tracking-tight text-brand-text"
      >
        Que voulez-vous savoir ?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="mt-2 max-w-md text-[13.5px] leading-relaxed text-gray-500"
      >
        Posez votre question en langage courant. La réponse est rédigée à partir du
        Livre de Connaissances AsCoCid{fiches ? ` — ${fiches} fiches` : ""}, avec ses
        sources et ses schémas.
      </motion.p>

      <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {suggestions.slice(0, 4).map((s, i) => (
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
