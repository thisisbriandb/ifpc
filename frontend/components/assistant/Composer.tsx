"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";

/**
 * Zone de saisie.
 *
 * Entrée envoie, Maj+Entrée passe à la ligne : c'est la convention d'un chat,
 * et l'inverse surprend. Le champ grandit avec le texte jusqu'à une limite,
 * au-delà de laquelle il défile — une question de dix lignes ne doit pas
 * pousser la conversation hors de l'écran.
 */
export default function Composer({
  valeur,
  onChange,
  onEnvoyer,
  onArreter,
  enCours,
  placeholder,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onEnvoyer: () => void;
  onArreter: () => void;
  enCours: boolean;
  placeholder: string;
}) {
  const champ = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [valeur]);

  const touche = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!enCours && valeur.trim()) onEnvoyer();
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_2px_20px_rgba(0,0,0,0.04)]
      transition-colors focus-within:border-brand-primary/40">
      <div className="flex items-end gap-2">
        <textarea
          ref={champ}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={touche}
          rows={1}
          placeholder={placeholder}
          className="max-h-[180px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px]
            leading-relaxed text-brand-text outline-none placeholder:text-gray-400"
        />
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={enCours ? onArreter : onEnvoyer}
          disabled={!enCours && !valeur.trim()}
          aria-label={enCours ? "Arrêter" : "Envoyer"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors
            ${enCours
              ? "bg-brand-text text-white"
              : "bg-brand-primary text-white disabled:bg-gray-100 disabled:text-gray-300"}`}
        >
          {enCours ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
        </motion.button>
      </div>
    </div>
  );
}
