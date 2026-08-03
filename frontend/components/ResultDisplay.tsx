"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface EvaluationMicro {
  key: string;
  nom: string;
  t_ref: number;
  z: number;
  d_ref: number;
  vp: number;
  k_calc: number;
  statut: string;
  message: string;
}

interface RisqueData {
  niveau: string;
  score: number;
  couleur: string;
  conseil: string;
}

interface ResultData {
  vp: number;
  vp_cible: number;
  k_calc?: number;
  statut: string;
  message: string;
  evaluations_multimicro?: EvaluationMicro[];
  risque: RisqueData;
  parametres: {
    t_ref: number;
    z: number;
    d_ref?: number;
    microorganisme: string;
    microorganisme_key?: string;
    produit: string;
    product_type?: string;
    lot_identifier?: string;
    clarification: string | null;
    procede: string | null;
    ph?: number;
    titre_alcool?: number;
  };
  courbe?: {
    temps: number[];
    temperatures: number[];
    vp_cumulee?: number[];
  };
}

interface Props {
  result: ResultData;
}

const BADGE_STYLES: Record<string, string> = {
  conforme: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-bold",
  insuffisant: "bg-red-500/10 text-red-700 border-red-500/20 font-bold",
};

export function ReductionFactorHelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-black/[0.08] relative space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-brand-primary font-bold">
            <Info className="w-5 h-5" />
            <span>Facteur de réduction (k)</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-gray-600 leading-relaxed space-y-3">
          <p>
            <strong>Conforme pour un microorganisme de référence donné</strong>, dans l&apos;hypothèse d&apos;une population initiale de 10<sup>6</sup> ufc/mL avant pasteurisation et la présence de moins de 1 microorganisme pour 1 000 000 bouteilles après traitement thermique ce qui équivaut à une réduction logarithmique de 15.
          </p>
          <p className="bg-gray-50 p-3 rounded-xl border border-gray-100 italic text-gray-500">
            Ce facteur correspond à la réduction logarithmique de la population microbienne. Par exemple, si ce facteur est de 6, cela équivaut à une division de la population par 10<sup>6</sup>, soit une division par 1 000 000.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-primary text-white font-semibold text-xs rounded-xl shadow-sm hover:opacity-90 transition-opacity"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export function MicroEvaluationCard({
  evalItem,
  onOpenHelp,
}: {
  evalItem: EvaluationMicro;
  onOpenHelp: () => void;
}) {
  const isConforme = evalItem.statut === "conforme";
  const badgeCls = BADGE_STYLES[evalItem.statut] || BADGE_STYLES.insuffisant;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-shadow">
      <div>
        {/* Diagnostic message */}
        <p className="text-xs text-gray-700 font-medium leading-relaxed mb-3">
          {evalItem.message}
        </p>

        {/* Micro-organisme de référence */}
        <div className="text-[11px] text-gray-500 mb-1">
          Microorganisme de référence :
          <div className="font-bold text-gray-900 italic text-xs mt-0.5">{evalItem.nom}</div>
        </div>

        {/* Reference parameters & VP */}
        <div className="text-[10px] text-gray-500 font-mono mt-2 pt-2 border-t border-dashed border-gray-100 flex flex-wrap items-center justify-between gap-1">
          <span>Tref : {evalItem.t_ref}°C ; Z : {evalItem.z}°C ; D : {evalItem.d_ref} min.</span>
          <span className="font-bold text-brand-primary">VP : {evalItem.vp >= 100 ? evalItem.vp.toFixed(0) : evalItem.vp.toFixed(2)} UP</span>
        </div>
      </div>

      {/* Status & Reduction factor strip */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
        <div>
          <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md border ${badgeCls}`}>
            {isConforme ? "CONFORME" : "INSUFFISANT"}
          </span>
        </div>

        <div className="text-right flex items-center gap-1.5">
          <div className="text-[10px] text-gray-400 font-semibold uppercase">Facteur de réduction :</div>
          <div className="text-sm font-bold font-mono text-gray-900">{evalItem.k_calc.toFixed(1)}</div>
          <button
            onClick={onOpenHelp}
            className="text-gray-400 hover:text-brand-primary p-0.5 transition-colors"
            title="Explication du facteur de réduction"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultDisplay({ result }: Props) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const evaluations = result.evaluations_multimicro;

  return (
    <div className="space-y-6">
      <ReductionFactorHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {evaluations && evaluations.length > 0 ? (
        /* Multi-microorganism grid for Jus de Pomme */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider">
              Analyse de conformité par microorganisme
            </h3>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Qu&apos;est-ce que le facteur de réduction ?</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluations.map((evalItem) => (
              <MicroEvaluationCard
                key={evalItem.key}
                evalItem={evalItem}
                onOpenHelp={() => setIsHelpOpen(true)}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Single microorganism display (Cidre / Expert mode) */
        <div className="bg-white rounded-2xl border border-black/[0.06] p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Microorganisme de référence</span>
              <h4 className="text-sm font-bold text-gray-900 italic">{result.parametres.microorganisme}</h4>
            </div>
            <span
              className={`text-[10px] uppercase tracking-wider px-3 py-1 rounded-md border ${
                BADGE_STYLES[result.statut] || BADGE_STYLES.insuffisant
              }`}
            >
              {result.statut === "conforme" ? "CONFORME" : "INSUFFISANT"}
            </span>
          </div>

          <p className="text-xs text-gray-700 leading-relaxed font-medium">
            {result.message}
          </p>

          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-[10px] font-mono text-gray-500 flex flex-wrap items-center gap-3">
              <span>Tref : {result.parametres.t_ref}°C ; Z : {result.parametres.z}°C ; D : {result.parametres.d_ref || "--"} min.</span>
              <span className="font-bold text-brand-primary border-l border-gray-200 pl-2.5">VP : {result.vp >= 100 ? result.vp.toFixed(0) : result.vp.toFixed(2)} UP</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Facteur de réduction :</span>
              <span className="text-sm font-bold font-mono text-gray-900">
                {(result.k_calc !== undefined && result.k_calc !== null) ? result.k_calc.toFixed(1) : (result.vp / (result.parametres.d_ref || 1)).toFixed(1)}
              </span>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="text-gray-400 hover:text-brand-primary p-0.5 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
