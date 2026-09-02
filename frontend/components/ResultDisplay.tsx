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


interface ResultData {
  vp: number;
  vp_cible: number;
  k_calc?: number;
  statut: string;
  message: string;
  evaluations_multimicro?: EvaluationMicro[];
  parametres: {
    t_ref: number;
    z: number;
    d_ref?: number;
    microorganisme: string;
    microorganisme_key?: string;
    produit: string;
    product_type?: string;
    lot_identifier?: string;
    unite_temps?: string | null;
    unite_temps_nom?: string | null;
    procede: string | null;
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
      {/* Header — Micro-organisme de référence & Badge de statut */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 gap-2">
        <div>
          <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
            Microorganisme de référence
          </span>
          <h4 className="text-xs sm:text-sm font-bold text-gray-900 italic leading-snug">
            {evalItem.nom}
          </h4>
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md border shrink-0 ${badgeCls}`}>
          {isConforme ? "CONFORME" : "INSUFFISANT"}
        </span>
      </div>

      {/* Body — Message de diagnostic */}
      <p className="text-xs text-gray-700 leading-relaxed font-medium flex-1">
        {evalItem.message}
      </p>

      {/* Footer — Paramètres & Facteur de réduction */}
      <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-[10px] font-mono text-gray-500 flex flex-wrap items-center gap-2">
          <span>Tref : {evalItem.t_ref}°C ; Z : {evalItem.z}°C ; D : {evalItem.d_ref} min.</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-gray-400 font-semibold uppercase">Facteur de réduction :</span>
          <span className="text-sm font-bold font-mono text-gray-900">{evalItem.k_calc.toFixed(1)}</span>
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

  const singleEval: EvaluationMicro = {
    key: result.parametres.microorganisme_key || "single",
    nom: result.parametres.microorganisme,
    t_ref: result.parametres.t_ref,
    z: result.parametres.z,
    d_ref: result.parametres.d_ref || 1.0,
    vp: result.vp,
    k_calc: result.k_calc !== undefined && result.k_calc !== null ? result.k_calc : result.vp / (result.parametres.d_ref || 1),
    statut: result.statut,
    message: result.message,
  };

  const evalList = (evaluations && evaluations.length > 0) ? evaluations : [singleEval];

  return (
    <div className="space-y-6">
      <ReductionFactorHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

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
          {evalList.map((evalItem) => (
            <MicroEvaluationCard
              key={evalItem.key}
              evalItem={evalItem}
              onOpenHelp={() => setIsHelpOpen(true)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
