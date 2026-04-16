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
    lot_identifier?: string;
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
  const statutConfig: Record<string, { icon: any; color: string; bg: string; border: string; badge: string }> = {
    conforme:    { icon: CheckCircle,   color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
    vigilance:   { icon: AlertTriangle, color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   badge: "bg-amber-100 text-amber-700" },
    insuffisant: { icon: XCircle,       color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     badge: "bg-red-100 text-red-700" },
  };

  const cfg = statutConfig[result.statut] || statutConfig.insuffisant;
  const StatusIcon = cfg.icon;

  const maxTemp = Math.max(...(result.courbe?.temperatures || [0]));
  const duree = result.courbe?.temps && result.courbe.temps.length > 0
    ? Math.max(...result.courbe.temps)
    : 0;

  return (
    <div className="space-y-4">
      {/* Row 1 — three equal KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Statut */}
        <div className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`}>
          <p className="text-xs font-semibold text-gray-500 mb-2">{t("resultDisplay.lotVerdict")}</p>
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
            <span className={`text-sm font-bold px-2 py-0.5 rounded ${cfg.badge} capitalize`}>{result.statut}</span>
          </div>
        </div>

        {/* VP */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">{t("resultDisplay.pasteurisationValue")}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{result.vp.toFixed(2)}</span>
            <span className="text-sm font-medium text-gray-400">/ {result.vp_cible.toFixed(1)} UP</span>
          </div>
        </div>

        {/* Risque */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">{t("resultDisplay.risk")}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900 capitalize">{result.risque.niveau}</span>
            <span className="text-xs font-medium text-gray-400">{t("resultDisplay.score", { n: result.risque.score })}</span>
          </div>
        </div>
      </div>

      {/* Row 2 — secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">{t("resultDisplay.maxTemperature")}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900 tabular-nums">{maxTemp.toFixed(1)}</span>
            <span className="text-sm font-medium text-gray-400">°C</span>
          </div>
        </div>
        {duree > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">{t("resultDisplay.cycleDuration")}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900 tabular-nums">{duree.toFixed(0)}</span>
              <span className="text-sm font-medium text-gray-400">min</span>
            </div>
          </div>
        )}
      </div>

      {/* Message & conseil */}
      <div className="border-l-2 pl-4 py-1" style={{ borderColor: result.risque.couleur }}>
        <p className="text-sm font-medium text-gray-700 leading-relaxed">{result.message}</p>
        {result.risque.conseil && (
          <p className="text-xs text-gray-500 mt-1">{result.risque.conseil}</p>
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
          { label: t("resultDisplay.lotIdentifier"), value: result.parametres.lot_identifier },
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
