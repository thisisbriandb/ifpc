"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import type { IllustrationLdc } from "@/lib/ldc";

/**
 * Les images de la réponse — c'est le repère visuel des utilisateurs d'AsCoCid.
 *
 * Trois natures, trois traitements (spec 07 §2.1) :
 *   schema   carte cliquable : les zones sont replacées en pourcentage, donc
 *            justes à n'importe quelle taille d'affichage ; celles que la
 *            réponse concerne sont marquées.
 *   planche  fiche de variété : l'image EST le contenu. En grand, ou pas du tout.
 *   figure   accompagnement : vignette, agrandissable.
 */
export default function IllustrationPanel({
  illustrations,
  onOuvrirFiche,
}: {
  illustrations: IllustrationLdc[];
  onOuvrirFiche: (idoc: number) => void;
}) {
  const [agrandie, setAgrandie] = useState<IllustrationLdc | null>(null);

  useEffect(() => {
    if (!agrandie) return;
    const fermer = (e: KeyboardEvent) => e.key === "Escape" && setAgrandie(null);
    window.addEventListener("keydown", fermer);
    return () => window.removeEventListener("keydown", fermer);
  }, [agrandie]);

  if (!illustrations.length) return null;

  const majeures = illustrations.filter((i) => i.essentielle || i.nature === "schema");
  const vignettes = illustrations.filter((i) => !i.essentielle && i.nature !== "schema");

  return (
    <>
      <div className="mt-4 space-y-3">
        {majeures.map((illu, i) => (
          <motion.figure
            key={illu.fiche_idoc}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
          >
            <div className="relative">
              {/* Un schéma garde ses proportions exactes : ses zones sont
                  positionnées en pourcentage du cadre, et une image centrée
                  dans un cadre plus grand qu'elle décalerait tous les repères.
                  Les autres images sont plafonnées, faute de quoi une planche
                  d'un millier de pixels occupe l'écran entier. */}
              <img
                src={illu.url}
                alt={illu.legende}
                loading="lazy"
                className={`w-full bg-white ${
                  illu.zones.length ? "" : "max-h-[420px] object-contain"}`}
                style={{ aspectRatio: illu.largeur && illu.hauteur
                  ? `${illu.largeur} / ${illu.hauteur}` : undefined }}
              />
              {illu.zones.map((z, n) => (
                <button
                  key={`${z.cible_idoc}-${n}`}
                  onClick={() => onOuvrirFiche(z.cible_idoc)}
                  title={z.libelle}
                  aria-label={z.libelle}
                  className="group absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${z.x_pct}%`, top: `${z.y_pct}%` }}
                >
                  <span
                    className={`block h-3 w-3 rounded-full ring-2 ring-white transition-transform
                      duration-150 group-hover:scale-150 ${
                        z.active ? "bg-brand-accent" : "bg-brand-primary/45"
                      }`}
                  />
                  {z.active && (
                    <motion.span
                      className="absolute inset-0 rounded-full bg-brand-accent/40"
                      animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  <span className="pointer-events-none absolute left-4 top-1/2 z-10 hidden
                    -translate-y-1/2 whitespace-nowrap rounded-lg bg-brand-text/90 px-2 py-1
                    text-[11px] text-white group-hover:block">
                    {z.libelle}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setAgrandie(illu)}
                className="absolute right-2 top-2 rounded-lg bg-white/85 p-1.5 text-gray-500
                  backdrop-blur transition-colors hover:text-brand-primary"
                aria-label="Agrandir"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <figcaption className="flex items-center justify-between gap-3 border-t
              border-gray-50 px-3 py-2 text-[11px] text-gray-500">
              <span className="truncate">{illu.legende}</span>
              <span className="shrink-0 text-gray-300">
                {illu.nature === "schema"
                  ? `${illu.zones.length} étapes cliquables`
                  : "planche"}
              </span>
            </figcaption>
          </motion.figure>
        ))}

        {vignettes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {vignettes.map((illu, i) => (
              <motion.button
                key={illu.fiche_idoc}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                onClick={() => setAgrandie(illu)}
                className="group relative h-20 w-28 overflow-hidden rounded-xl border
                  border-gray-100 bg-white transition-colors hover:border-brand-primary/40"
                title={illu.legende}
              >
                <img src={illu.url} alt={illu.legende} loading="lazy"
                     className="h-full w-full object-cover transition-transform duration-300
                       group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-white/85 px-1.5 py-1
                  text-[10px] text-gray-600 backdrop-blur-sm">
                  {illu.legende}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {agrandie && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setAgrandie(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-text/70
              p-6 backdrop-blur-sm"
          >
            <motion.img
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              src={agrandie.url}
              alt={agrandie.legende}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-xl bg-white shadow-2xl"
            />
            <button
              onClick={() => setAgrandie(null)}
              className="absolute right-5 top-5 rounded-full bg-white/90 p-2 text-gray-600
                transition-colors hover:text-brand-text"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
