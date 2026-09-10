"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Maximize2, X } from "lucide-react";

import AssistantChat from "./AssistantChat";

/**
 * Accès permanent au Livre de Connaissances, depuis n'importe quel écran.
 *
 * Le chat s'ouvre **en place**, il ne redirige pas : la question naît pendant
 * une saisie — « pourquoi le trouble change-t-il la cible ? » au milieu d'un
 * relevé — et une navigation ferait perdre le travail en cours. Le lien
 * « ouvrir en grand » reste là pour les échanges longs.
 */

/** Écrans où la bulle n'a rien à faire, ou dont le coin bas-droit est déjà pris. */
const MASQUE = [
  "/assistant",      // l'assistant y est déjà en pleine page
  "/login",
  "/reset-password",
  "/cuves/chai",     // panneau fixe en bas à droite (page.tsx:1116)
];

/** Écrans dont le bouton flottant mobile occupe le même coin. */
const DECALE_SUR_MOBILE = ["/controle", "/bareme"];

export default function AssistantLauncher() {
  const chemin = usePathname() ?? "";
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [ouvert]);

  // Changer de page referme le panneau : le fil suivrait sinon l'utilisateur
  // sur un écran sans rapport avec sa question.
  useEffect(() => setOuvert(false), [chemin]);

  if (MASQUE.some((p) => chemin === p || chemin.startsWith(`${p}/`))) return null;

  const decale = DECALE_SUR_MOBILE.some((p) => chemin.startsWith(p));

  return (
    <>
      <AnimatePresence>
        {ouvert && (
          <>
            {/* Sur mobile le panneau est plein écran : sans voile, le fond
                défilerait derrière lui. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOuvert(false)}
              className="fixed inset-0 z-[85] bg-brand-text/20 backdrop-blur-[2px] sm:bg-transparent
                sm:backdrop-blur-0"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="fixed inset-x-0 bottom-0 top-14 z-[90] flex flex-col overflow-hidden
                border border-gray-100 bg-brand-gray shadow-2xl
                sm:inset-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[560px] sm:w-[400px]
                sm:rounded-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100
                bg-white px-3 py-2">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-text">
                  <BookOpen className="h-4 w-4 text-brand-primary" />
                  Livre de Connaissances
                </span>
                <span className="flex items-center gap-1">
                  <Link
                    href="/assistant"
                    onClick={() => setOuvert(false)}
                    title="Ouvrir en grand"
                    aria-label="Ouvrir en grand"
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-50
                      hover:text-brand-primary"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => setOuvert(false)}
                    aria-label="Fermer l'assistant"
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-50
                      hover:text-brand-text"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <AssistantChat variante="panneau" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOuvert((v) => !v)}
        aria-label="Assistant du Livre de Connaissances"
        className={`fixed right-6 z-[95] flex h-12 items-center gap-2 rounded-full bg-brand-primary
          px-4 text-white shadow-lg transition-shadow hover:shadow-xl
          ${decale ? "bottom-24 lg:bottom-6" : "bottom-6"}`}
      >
        <BookOpen className="h-5 w-5 shrink-0" />
        <span className="hidden text-[13px] font-medium sm:inline">Assistant</span>
      </motion.button>
    </>
  );
}
