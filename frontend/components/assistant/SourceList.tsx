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
  sources,
  surligne,
  onOuvrir,
}: {
  sources: SourceLdc[];
  surligne: number | null;
  onOuvrir: (source: SourceLdc) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  if (!sources.length) return null;

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
        {sources.length} source{sources.length > 1 ? "s" : ""} du Livre
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
            {sources.map((s, i) => (
              <motion.li
                key={s.index}
                id={`source-${s.index}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
              >
                <button
                  onClick={() => onOuvrir(s)}
                  className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left
                    transition-colors ${
                      surligne === s.index
                        ? "border-brand-primary/40 bg-brand-primary/5"
                        : "border-gray-100 bg-white hover:border-brand-primary/30 hover:bg-brand-gray"
                    }`}
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded
                      bg-brand-primary/10 text-[10px] font-semibold text-brand-primary"
                  >
                    {s.index}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-brand-text">
                      {s.titre_fiche}
                    </span>
                    {(s.titre_section || s.terme) && (
                      <span className="block truncate text-[11px] text-gray-400">
                        {s.titre_section || `définition de « ${s.terme} »`}
                      </span>
                    )}
                  </span>
                  <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-gray-300" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
