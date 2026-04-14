"use client";

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface RisqueData {
  niveau: string;
  score: number;
  couleur: string;
  conseil: string;
}

interface ResultData {
  vp: number;
  vp_cible: number;
  statut: string;
  message: string;
  risque: RisqueData;
  parametres: {
    t_ref: number;
    z: number;
    microorganisme: string;
    produit: string;
    clarification: string | null;
    procede: string | null;
    ph?: number;
    titre_alcool?: number;
  };
  courbe?: {
    temps: number[];
    temperatures: number[];
  };
}

interface Props {
  result: ResultData;
}

export function KPICards({ result }: Props) {
  const { t } = useI18n();
  const statutConfig: Record<string, { icon: any; color: string; bg: string; border: string }> = {
    conforme: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50/80", border: "border-emerald-200" },
    vigilance: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50/80", border: "border-amber-200" },
    insuffisant: { icon: XCircle, color: "text-red-600", bg: "bg-red-50/80", border: "border-red-200" },
  };

  const cfg = statutConfig[result.statut] || statutConfig.insuffisant;
  const StatusIcon = cfg.icon;

  const maxTemp = Math.max(...(result.courbe?.temperatures || [0]));
  const duree = result.courbe?.temps && result.courbe.temps.length > 0
    ? Math.max(...result.courbe.temps)
    : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* COMBINED DIAGNOSTIC CARD */}
      <div className={`flex-1 p-6 md:p-8  shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex flex-col relative overflow-hidden ${cfg.bg} ${cfg.border}`}>
        {/* Bande de couleur latérale */}
        <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: result.risque.couleur }}></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pl-4 mb-6">
          {/* Statut */}
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">{t("resultDisplay.lotVerdict")}</p>
            <div className="flex items-center gap-3">
              <StatusIcon className={`w-8 h-8 ${cfg.color}`} />
              <h2 className={`text-3xl font-extrabold capitalize tracking-tight ${cfg.color}`}>{result.statut}</h2>
            </div>
          </div>

          {/* Séparateur */}
          <div className="hidden md:block w-px h-16 bg-gray-200/50"></div>

          {/* VP */}
          <div className="flex-1 md:text-center">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">{t("resultDisplay.pasteurisationValue")}</p>
            <div className="flex items-baseline md:justify-center gap-1">
              <p className="text-4xl font-extrabold tracking-tight text-gray-900">{result.vp.toFixed(2)}</p>
              <span className="text-sm font-bold text-gray-500">UP</span>
            </div>
          </div>

          {/* Séparateur */}
          <div className="hidden md:block w-px h-16 bg-gray-200/50"></div>

          {/* Risque */}
          <div className="flex-1 md:text-right">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">{t("resultDisplay.risk")}</p>
            <div className="flex items-center md:justify-end gap-2">
              <p className="text-2xl font-bold capitalize text-gray-900">{result.risque.niveau}</p>
            </div>
            <p className="text-[11px] text-gray-400 font-medium">{t("resultDisplay.score", { n: result.risque.score })}</p>
          </div>
        </div>

        {/* Message & Conseil intégrés */}
        <div className="pl-4 border-t border-gray-200/50 pt-5 mt-auto">
          <p className="text-[15px] font-medium text-gray-800 leading-relaxed mb-4">{result.message}</p>
          {result.risque.conseil && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 border border-gray-200/60 text-sm font-semibold text-gray-800">
              <span className="uppercase text-[10px] tracking-wider text-gray-500 font-bold">{t("resultDisplay.recommendation")}</span>
              {result.risque.conseil}
            </div>
          )}
        </div>
      </div>

      {/* METRICS SECONDAIRES */}
      <div className="w-full lg:w-72 flex md:flex-row lg:flex-col gap-4">
        {/* Temp Max */}
        <div className="bg-white p-6 rounded-2xl border border-brand-primary/30 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-1 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <span className="w-3 h-3 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(132,164,74,0.5)]"></span>
            <p className="text-xs text-brand-primary font-bold uppercase tracking-wider">{t("resultDisplay.maxTemperature")}</p>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <p className="text-4xl font-extrabold tracking-tight text-gray-900">{maxTemp.toFixed(1)}</p>
            <span className="text-lg font-bold text-brand-primary">°C</span>
          </div>
        </div>

        {/* Durée */}
        {duree > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex-1 flex flex-col justify-center relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{t("resultDisplay.cycleDuration")}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-extrabold tracking-tight text-gray-900">{duree.toFixed(0)}</p>
              <span className="text-sm font-bold text-gray-500">min</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ParametersTable({ result }: Props) {
  const { t } = useI18n();
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 grid grid-cols-2 gap-y-6 gap-x-4">
        {[
          { label: t("resultDisplay.product"), value: result.parametres.produit },
          { label: t("resultDisplay.microorganism"), value: result.parametres.microorganisme },
          { label: "Tref", value: `${result.parametres.t_ref} °C` },
          { label: "Z", value: `${result.parametres.z} °C` },
          { label: t("resultDisplay.clarification"), value: result.parametres.clarification },
          { label: t("resultDisplay.process"), value: result.parametres.procede },
          { label: "pH", value: result.parametres.ph },
          { label: t("resultDisplay.alcohol"), value: result.parametres.titre_alcool ? `${result.parametres.titre_alcool}%` : null },
        ].filter(i => i.value !== null && i.value !== undefined).map((item, idx) => (
          <div key={idx}>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{item.label}</p>
            <p className="text-sm font-medium text-gray-900 capitalize">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultDisplay({ result }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <KPICards result={result} />

      {/* Bloc Analyse redessiné sans icône, avec une bordure gauche d'indication */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: result.risque.couleur }}></div>
        <div className="p-5 flex-1">
          <h4 className="font-bold text-gray-900 mb-2">{t("resultDisplay.analysisTitle")}</h4>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{result.message}</p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-50 border border-gray-100 text-gray-700">
            <span className="uppercase text-[10px] tracking-wider text-gray-500">{t("resultDisplay.advice")}</span>
            {result.risque.conseil}
          </div>
        </div>
      </div>
    </div>
  );
}
