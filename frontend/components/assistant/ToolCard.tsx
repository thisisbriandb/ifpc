"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Calculator } from "lucide-react";
import type { OutilLdc } from "@/lib/ldc";

/**
 * Renvoi vers un outil de la plateforme.
 *
 * Le Livre explique les procédés ; il ne calcule pas sur les données d'un
 * producteur. Quand la question porte sur son lot à lui, l'assistant ne
 * bricole pas une réponse : il ouvre l'outil qui traite le cas (spec 04 §6.0).
 */
export default function ToolCard({ outil }: { outil: OutilLdc }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-4"
    >
      <Link
        href={outil.url}
        className="group flex items-center gap-3 rounded-2xl border border-brand-accent/25
          bg-brand-accent/[0.06] px-4 py-3 transition-colors hover:bg-brand-accent/10"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
          bg-brand-accent/15 text-brand-accent">
          <Calculator className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-brand-text">{outil.nom}</span>
          <span className="block truncate text-[12px] text-gray-500">{outil.objet}</span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-accent transition-transform
          group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}
