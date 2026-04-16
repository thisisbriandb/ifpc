"use client";

// Icons removed from status display — minimalist dot + badge approach
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
    d_ref?: number;
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
    vp_cumulee?: number[];
  };
}

interface Props {
  result: ResultData;
}

function computeInsights(result: ResultData) {
  const ratio = result.vp_cible > 0 ? result.vp / result.vp_cible : 0;
  const k = result.parametres.d_ref && result.parametres.d_ref > 0
    ? result.vp / result.parametres.d_ref
    : null;

  let multiplierText: string;
  if (ratio >= 1) {
    multiplierText = ratio >= 10
      ? `×${Math.round(ratio)}`
      : `×${ratio.toFixed(1)}`;
  } else {
    multiplierText = `${(ratio * 100).toFixed(1)}%`;
  }

  let vpReachedAtMin: number | null = null;
  const courbe = result.courbe;
  if (courbe?.vp_cumulee && courbe.temps) {
    for (let i = 0; i < courbe.vp_cumulee.length; i++) {
      if (courbe.vp_cumulee[i] >= result.vp_cible) {
        vpReachedAtMin = courbe.temps[i];
        break;
      }
    }
  }

  return { ratio, k, multiplierText, vpReachedAtMin };
}

export function KPICards({ result }: Props) {
  const { t } = useI18n();
  const statutConfig: Record<string, { color: string; badge: string }> = {
    conforme:    { color: "text-brand-primary", badge: "bg-brand-primary/8 text-brand-primary border-brand-primary/15" },
    vigilance:   { color: "text-brand-accent",  badge: "bg-brand-accent/8 text-brand-accent border-brand-accent/15" },
    insuffisant: { color: "text-red-600",       badge: "bg-red-500/6 text-red-600 border-red-500/10" },
  };

  const cfg = statutConfig[result.statut] || statutConfig.insuffisant;

  const maxTemp = Math.max(...(result.courbe?.temperatures || [0]));
  const duree = result.courbe?.temps && result.courbe.temps.length > 0
    ? Math.max(...result.courbe.temps)
    : 0;

  const { ratio, k, multiplierText, vpReachedAtMin } = computeInsights(result);

  return (
    <div className="space-y-2">
      {/* ── VERDICT — open, no box ── */}
      <div className="px-1">
        {/* Score */}
        <span className={`text-5xl font-bold font-mono tracking-tighter leading-none ${cfg.color}`}>
          {result.vp.toFixed(2)}
        </span>

        {/* Status line: ratio + badge */}
        <div className="flex items-center gap-2.5 mt-2">
          <span className="text-sm font-mono text-gray-400">
            / {result.vp_cible.toFixed(1)} UP
          </span>
          <span className={`text-sm font-mono ${
            ratio < 1 ? "text-red-500 font-bold" :
            ratio >= 50 ? "text-brand-accent font-extrabold" :
            ratio >= 5 ? "text-brand-accent font-bold" :
            "text-gray-400 font-medium"
          }`}>
            {multiplierText}
          </span>
          <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.badge}`}>{result.statut}</span>
        </div>

        {/* Primary text: conseil if available, otherwise message */}
        <p className="text-[13px] text-gray-500 leading-relaxed max-w-xl mt-3">
          {result.risque.conseil || result.message}
        </p>

        {/* Timeline + k insight */}
        <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-gray-400">
          {vpReachedAtMin !== null ? (
            <span>{t("resultDisplay.targetReachedAt", { n: vpReachedAtMin.toFixed(0) })}</span>
          ) : (
            <span>{t("resultDisplay.targetNeverReached")}</span>
          )}
          {k !== null && (
            <>
              <span className="text-gray-300">·</span>
              <span>k = {k.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>

      {/* ── METRICS — single data strip ── */}
      <div className="flex items-center gap-0 rounded-lg border border-black/[0.06] bg-white overflow-hidden">
        <div className="flex-1 px-4 py-2.5">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t("resultDisplay.maxTemperature")}</p>
          <span className="text-lg font-bold font-mono text-brand-text tracking-tight">{maxTemp.toFixed(1)}</span>
          <span className="text-[10px] text-gray-400 ml-0.5">°C</span>
        </div>
        {duree > 0 && (
          <>
            <div className="w-px h-8 bg-black/[0.06]" />
            <div className="flex-1 px-4 py-2.5">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t("resultDisplay.cycleDuration")}</p>
              <span className="text-lg font-bold font-mono text-brand-text tracking-tight">{duree.toFixed(0)}</span>
              <span className="text-[10px] text-gray-400 ml-0.5">min</span>
            </div>
          </>
        )}
        <div className="w-px h-8 bg-black/[0.06]" />
        <div className="flex-1 px-4 py-2.5">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Tref</p>
          <span className="text-lg font-bold font-mono text-brand-text tracking-tight">{result.parametres.t_ref}</span>
          <span className="text-[10px] text-gray-400 ml-0.5">°C</span>
        </div>
        {k !== null && (
          <>
            <div className="w-px h-8 bg-brand-primary/20" />
            <div className="flex-1 px-4 py-2.5">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t("resultDisplay.kFactor")}</p>
              <span className="text-lg font-bold font-mono text-brand-text tracking-tight">{k.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ParametersTable({ result }: Props) {
  const { t } = useI18n();
  return (
    <div className="bg-gray-50 rounded-lg border border-black/[0.06] overflow-hidden">
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
      <div className="bg-white rounded-lg border border-black/[0.06] overflow-hidden flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: result.risque.couleur }}></div>
        <div className="p-5 flex-1">
          <h4 className="font-bold text-brand-text mb-2">{t("resultDisplay.analysisTitle")}</h4>
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
