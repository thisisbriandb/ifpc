"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * Ce que le service est en train de faire, pendant les quelques secondes que
 * dure une réponse.
 *
 * Un indicateur muet ferait passer six secondes pour une panne. Les étapes
 * affichées sont réelles : elles suivent les événements du flux (analyse, puis
 * sources, puis premier fragment de texte), jamais une minuterie décorative.
 */
export default function Thinking({ etape }: { etape: "analyse" | "recherche" | "redaction" }) {
  const libelles = {
    analyse: "Analyse de la demande…",
    recherche: "Recherche dans le Livre de Connaissances…",
    redaction: "Rédaction de la réponse sourcée…",
  } as const;

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-brand-primary"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={etape}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-[13px] text-gray-500"
        >
          {libelles[etape]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
