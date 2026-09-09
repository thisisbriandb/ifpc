"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, X } from "lucide-react";
import { lireFiche, type FicheLdc } from "@/lib/ldc";

/**
 * Panneau de lecture d'une fiche, ouvert depuis une citation ou une étape de schéma.
 *
 * L'enjeu est la vérifiabilité : une citation qu'on ne peut pas ouvrir ne vaut
 * pas mieux qu'une absence de citation. Le panneau garde la conversation
 * visible derrière lui — vérifier une source ne doit pas coûter la perte du fil.
 *
 * La pile de navigation interne (`pile`) permet de suivre un « voir aussi » ou
 * une étape de schéma puis de revenir, comme dans AsCoCid.
 */
export default function FicheDrawer({
  idoc,
  onFermer,
}: {
  idoc: number | null;
  onFermer: () => void;
}) {
  const [pile, setPile] = useState<number[]>([]);
  const [fiche, setFiche] = useState<FicheLdc | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const courant = pile[pile.length - 1] ?? null;

  useEffect(() => {
    setPile(idoc === null ? [] : [idoc]);
  }, [idoc]);

  useEffect(() => {
    if (courant === null) return;
    const abandon = new AbortController();
    setChargement(true);
    setErreur("");
    lireFiche(courant, abandon.signal)
      .then(setFiche)
      .catch((e) => { if (e.name !== "AbortError") setErreur("Fiche indisponible."); })
      .finally(() => setChargement(false));
    return () => abandon.abort();
  }, [courant]);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFermer]);

  return (
    <AnimatePresence>
      {idoc !== null && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onFermer}
            className="fixed inset-0 z-[70] bg-brand-text/20 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 z-[80] flex h-screen w-full max-w-md flex-col
              border-l border-gray-100 bg-white shadow-2xl sm:max-w-lg"
          >
            <header className="flex items-start gap-2 border-b border-gray-50 px-5 py-4">
              {pile.length > 1 && (
                <button
                  onClick={() => setPile((p) => p.slice(0, -1))}
                  className="mt-0.5 rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-brand-text"
                  aria-label="Retour"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold leading-snug text-brand-text">
                  {fiche?.titre ?? "…"}
                </h2>
                {fiche && (
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {fiche.code}
                    {fiche.modifie_le ? ` · mis à jour le ${fiche.modifie_le}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={onFermer}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-brand-text"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {chargement && (
                <div className="flex items-center gap-2 py-8 text-[13px] text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la fiche…
                </div>
              )}
              {erreur && <p className="py-8 text-[13px] text-red-600">{erreur}</p>}

              {!chargement && fiche && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  {fiche.illustration && (
                    <div className="relative overflow-hidden rounded-xl border border-gray-100">
                      <img src={fiche.illustration} alt={fiche.titre} loading="lazy"
                           className="w-full" />
                      {fiche.carte?.zones.map((z, i) => (
                        <button
                          key={`${z.cible_idoc}-${i}`}
                          onClick={() => setPile((p) => [...p, z.cible_idoc])}
                          title={z.libelle}
                          aria-label={z.libelle}
                          className="group absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${z.x_pct}%`, top: `${z.y_pct}%` }}
                        >
                          <span className="block h-2.5 w-2.5 rounded-full bg-brand-primary/50
                            ring-2 ring-white transition-transform group-hover:scale-150" />
                        </button>
                      ))}
                    </div>
                  )}

                  {fiche.blocs.map((b, i) => {
                    if (b.type === "definition" || b.type === "motcle") {
                      return (
                        <div key={i} className="rounded-xl border-l-2 border-brand-primary/40
                          bg-brand-gray px-3 py-2">
                          {b.terme && (
                            <p className="text-[12px] font-semibold text-brand-primary">{b.terme}</p>
                          )}
                          <p className="text-[13px] leading-relaxed text-gray-600">{b.texte}</p>
                        </div>
                      );
                    }
                    return (
                      <div key={i}>
                        {b.titre_section && (
                          <h3 className="mb-1 text-[13px] font-semibold text-brand-text">
                            {b.titre_section}
                          </h3>
                        )}
                        <p className={`text-[13.5px] leading-relaxed ${
                          b.type === "resume" ? "text-brand-text" : "text-gray-600"}`}>
                          {b.texte}
                        </p>
                      </div>
                    );
                  })}

                  {fiche.voir_aussi.length > 0 && (
                    <div className="border-t border-gray-50 pt-3">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Voir aussi
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {fiche.voir_aussi.map((v) => (
                          <button
                            key={v.idoc}
                            onClick={() => setPile((p) => [...p, v.idoc])}
                            className="rounded-lg border border-gray-100 bg-white px-2 py-1
                              text-[12px] text-gray-600 transition-colors
                              hover:border-brand-primary/30 hover:text-brand-primary"
                          >
                            {v.titre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {fiche && (
              <footer className="border-t border-gray-50 px-5 py-3">
                <a
                  href={fiche.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-gray-500
                    transition-colors hover:text-brand-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ouvrir dans AsCoCid
                </a>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
