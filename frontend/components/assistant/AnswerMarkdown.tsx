"use client";

import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { baliserCitations, numeroDeCitation, type SourceLdc } from "@/lib/ldc";

/**
 * Rendu de la réponse : markdown + citations cliquables.
 *
 * Les marqueurs [S1] produits par le modèle sont convertis en liens markdown
 * avant le rendu (`baliserCitations`), puis interceptés ici. On évite ainsi de
 * parcourir l'arbre rendu à la main, et le texte reste du markdown valide à
 * chaque fragment reçu — le streaming n'a pas d'état intermédiaire illisible.
 *
 * Une citation dont la source n'existe pas est affichée en gris et sans lien :
 * un numéro inventé par le modèle ne doit pas ressembler à une référence
 * vérifiée (spec 07 §4).
 */
export default function AnswerMarkdown({
  texte,
  sources,
  onCitation,
}: {
  texte: string;
  sources: SourceLdc[];
  onCitation?: (source: SourceLdc) => void;
}) {
  const parIndex = new Map(sources.map((s) => [s.index, s]));

  return (
    <div
      className="prose prose-sm max-w-none text-[15px] leading-[1.75] text-brand-text
        prose-headings:font-semibold prose-headings:text-brand-text
        prose-strong:font-semibold prose-strong:text-brand-text
        prose-li:my-1 prose-p:my-3 prose-ol:my-3 prose-ul:my-3"
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }: any) => {
            const numero = numeroDeCitation(href);
            if (numero === null) {
              return (
                <a href={href} target="_blank" rel="noreferrer"
                   className="text-brand-link underline underline-offset-2">
                  {children}
                </a>
              );
            }
            const source = parIndex.get(numero);
            if (!source) {
              return (
                <span className="mx-0.5 rounded px-1 text-[11px] font-medium text-gray-400"
                      title="Source introuvable dans les passages fournis">
                  [{numero}]
                </span>
              );
            }
            return (
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => onCitation?.(source)}
                title={source.titre_fiche + (source.titre_section ? ` — ${source.titre_section}` : "")}
                className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center
                  rounded-md border border-brand-primary/20 bg-brand-primary/10 px-1
                  align-super text-[10px] font-semibold text-brand-primary no-underline
                  transition-colors hover:bg-brand-primary hover:text-white"
              >
                {numero}
              </motion.button>
            );
          },
        }}
      >
        {baliserCitations(texte)}
      </ReactMarkdown>
    </div>
  );
}
