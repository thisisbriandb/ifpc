"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { envoyerRetour } from "@/lib/ldc";

const MOTIFS = ["réponse fausse", "source manquante", "hors sujet"] as const;

/**
 * Pouce et motif — le seul mécanisme d'amélioration continue qui tienne (spec 07 §5).
 *
 * Le jeu d'évaluation initial vieillit ; l'usage réel, non. Un retour négatif
 * n'a de valeur que s'il dit *pourquoi* : les trois motifs correspondent aux
 * trois défauts que l'évaluation sait rejouer.
 */
export default function Feedback({
  question,
  reponse,
  sources,
}: {
  question: string;
  reponse: string;
  sources: number[];
}) {
  const [avis, setAvis] = useState<"utile" | "inutile" | null>(null);
  const [motifs, setMotifs] = useState<string[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    await navigator.clipboard.writeText(reponse);
    setCopie(true);
    setTimeout(() => setCopie(false), 1600);
  };

  const valider = async () => {
    await envoyerRetour({ question, reponse, utile: false, motifs, commentaire, sources });
    setEnvoye(true);
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            setAvis("utile");
            envoyerRetour({ question, reponse, utile: true, sources });
          }}
          disabled={avis !== null}
          aria-label="Réponse utile"
          className={`rounded-lg p-1.5 transition-colors ${
            avis === "utile"
              ? "text-brand-primary"
              : "text-gray-300 hover:bg-gray-50 hover:text-brand-primary"
          } disabled:cursor-default`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setAvis("inutile")}
          disabled={avis !== null}
          aria-label="Réponse inexacte"
          className={`rounded-lg p-1.5 transition-colors ${
            avis === "inutile"
              ? "text-brand-accent"
              : "text-gray-300 hover:bg-gray-50 hover:text-brand-accent"
          } disabled:cursor-default`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={copier}
          aria-label="Copier la réponse"
          className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50
            hover:text-brand-text"
        >
          {copie ? <Check className="h-3.5 w-3.5 text-brand-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {avis === "utile" && (
          <span className="ml-1 text-[11px] text-gray-400">Merci, c&apos;est noté.</span>
        )}
      </div>

      <AnimatePresence>
        {avis === "inutile" && !envoye && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="mb-2 text-[12px] text-gray-500">Qu&apos;est-ce qui n&apos;allait pas ?</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {MOTIFS.map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      setMotifs((v) => (v.includes(m) ? v.filter((x) => x !== m) : [...v, m]))
                    }
                    className={`rounded-lg border px-2 py-1 text-[12px] transition-colors ${
                      motifs.includes(m)
                        ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                        : "border-gray-100 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={2}
                placeholder="Précision (facultatif)"
                className="w-full resize-none rounded-lg border border-gray-100 px-2.5 py-2
                  text-[13px] outline-none transition-colors focus:border-brand-primary/40"
              />
              <button
                onClick={valider}
                className="mt-2 rounded-lg bg-brand-text px-3 py-1.5 text-[12px] font-medium
                  text-white transition-opacity hover:opacity-90"
              >
                Envoyer
              </button>
            </div>
          </motion.div>
        )}
        {envoye && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] text-gray-400"
          >
            Retour enregistré — il sera relu avec les questions d&apos;évaluation.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
