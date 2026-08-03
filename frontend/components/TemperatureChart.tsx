"use client";

import { useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
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
  courbe?: {
    temps: number[];
    vp_cumulee: number[];
  };
}

interface CourbeData {
  temps: number[];
  temperatures: number[];
  taux_letaux: number[];
  vp_cumulee: number[];
}

interface Props {
  courbe: CourbeData;
  evaluations?: EvaluationMicro[];
  tRef: number;
  vpCible: number;
  statut?: string;
  procede?: string | null;
}

const MICRO_COLORS: Record<string, string> = {
  saccharo_jus: "#2563eb",       // Blue
  ecoli: "#dc2626",              // Red
  byssochlamys_fulva: "#7c3aed", // Purple
  alicyclo_std: "#d97706",       // Amber
  default: "#dc2626",
};

const CustomTooltip = ({ active, payload, label, timeUnit, evaluations }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-3 py-2.5 rounded-xl border border-black/[0.08] shadow-lg text-[11px] space-y-1">
      <p className="font-mono font-bold text-brand-text mb-1 border-b border-gray-100 pb-1">
        {label} {timeUnit}
      </p>
      {data.temperature !== undefined && (
        <div className="flex justify-between gap-6">
          <span className="text-gray-400 font-medium">Température</span>
          <span className="font-mono font-bold text-brand-text">{data.temperature.toFixed(1)}°C</span>
        </div>
      )}
      {evaluations && evaluations.length > 0 ? (
        evaluations.map((ev: EvaluationMicro) => {
          const val = data[`vp_${ev.key}`];
          if (val === undefined) return null;
          return (
            <div key={ev.key} className="flex justify-between gap-6">
              <span className="text-gray-500 italic truncate max-w-[150px]" style={{ color: MICRO_COLORS[ev.key] || "#6b7280" }}>
                {ev.nom}
              </span>
              <span className="font-mono font-bold">{val.toFixed(2)} UP</span>
            </div>
          );
        })
      ) : (
        data.vp_cumulee !== undefined && (
          <div className="flex justify-between gap-6">
            <span className="text-gray-400 font-medium">VP</span>
            <span className="font-mono font-bold text-red-600">{data.vp_cumulee.toFixed(2)} UP</span>
          </div>
        )
      )}
    </div>
  );
};

function buildData(courbe: CourbeData, evaluations?: EvaluationMicro[]) {
  const n = Math.min(courbe.temps.length, courbe.temperatures.length);
  const out: Array<Record<string, number>> = [];

  for (let i = 0; i < n; i++) {
    const t = courbe.temps[i];
    const temp = courbe.temperatures[i];
    if (![t, temp].every((v) => typeof v === "number" && Number.isFinite(v))) continue;

    const row: Record<string, number> = { temps: t, temperature: temp };
    if (courbe.vp_cumulee && i < courbe.vp_cumulee.length) {
      row.vp_cumulee = courbe.vp_cumulee[i];
    }

    if (evaluations) {
      evaluations.forEach((ev) => {
        if (ev.courbe && ev.courbe.vp_cumulee && i < ev.courbe.vp_cumulee.length) {
          row[`vp_${ev.key}`] = ev.courbe.vp_cumulee[i];
        }
      });
    }

    out.push(row);
  }
  return out;
}

function buildTemperatureScale(data: Array<Record<string, number>>, tRef: number) {
  const values = data.map((d) => d.temperature);
  if (Number.isFinite(tRef)) values.push(tRef);

  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 100;
  let min = Math.floor(rawMin / 20) * 20;
  let max = Math.ceil(rawMax / 20) * 20;

  if (min === max) {
    min -= 20;
    max += 20;
  }

  const ticks: number[] = [];
  for (let tick = min; tick <= max; tick += 20) {
    ticks.push(tick);
  }

  return { domain: [min, max] as [number, number], ticks };
}

function buildTimeScale(data: Array<Record<string, number>>) {
  const values = data.map((d) => d.temps);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 0;
  const min = Math.floor(rawMin);
  const max = Math.ceil(rawMax);
  const range = max - min;

  let step = 1;
  if (range > 180) step = 30;
  else if (range > 90) step = 15;
  else if (range > 45) step = 10;
  else if (range > 25) step = 5;

  const ticks: number[] = [];
  for (let tick = min; tick <= max; tick += step) {
    ticks.push(tick);
  }

  if (!ticks.includes(max)) ticks.push(max);

  return { domain: [min, max] as [number, number], ticks };
}

function buildVpScale(data: Array<Record<string, number>>, evaluations?: EvaluationMicro[]) {
  const values: number[] = [];
  data.forEach((d) => {
    if (d.vp_cumulee !== undefined) values.push(d.vp_cumulee);
    if (evaluations) {
      evaluations.forEach((ev) => {
        if (d[`vp_${ev.key}`] !== undefined) values.push(d[`vp_${ev.key}`]);
      });
    }
  });

  const rawMax = Math.max(0, values.length ? Math.max(...values) : 0);
  const targetTickCount = 6;
  const roughStep = rawMax / targetTickCount || 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const niceStep =
    normalized <= 1 ? 1 :
    normalized <= 2 ? 2 :
    normalized <= 5 ? 5 :
    10;
  const step = niceStep * magnitude;
  const max = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= max; tick += step) {
    ticks.push(tick);
  }

  return { domain: [0, max] as [number, number], ticks };
}

type ChartView = "temp" | "vp" | "both";

export default function TemperatureChart({ courbe, evaluations, tRef, vpCible, procede }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<ChartView>("both");
  const [activeCurves, setActiveCurves] = useState<Record<string, boolean>>({
    saccharo_jus: true,
    ecoli: true,
    byssochlamys_fulva: true,
    alicyclo_std: true,
  });

  const data = buildData(courbe, evaluations);
  const isFlash = procede?.toLowerCase().includes("flash");
  const timeUnit = isFlash ? "sec." : "min.";
  const temperatureScale = buildTemperatureScale(data, tRef);
  const timeScale = buildTimeScale(data);
  const vpScale = buildVpScale(data, evaluations);

  const showTemp = view === "temp" || view === "both";
  const showVp = view === "vp" || view === "both";

  const views: { key: ChartView; label: string }[] = [
    { key: "temp", label: `${t("chart.temperature")} (°C)` },
    { key: "vp", label: "VP (UP)" },
    { key: "both", label: t("chart.bothCurves") },
  ];

  const toggleCurve = (key: string) => {
    setActiveCurves((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Toggle — view mode */}
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-md p-0.5 w-fit overflow-x-auto max-w-full">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all whitespace-nowrap ${
                view === v.key
                  ? "bg-white text-brand-text shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Multi-curve checkable legend for Jus de pomme */}
        {evaluations && evaluations.length > 0 && showVp && (
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100 text-[11px]">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Courbes VP :</span>
            {evaluations.map((ev) => {
              const color = MICRO_COLORS[ev.key] || MICRO_COLORS.default;
              const isChecked = activeCurves[ev.key] !== false;
              return (
                <label key={ev.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCurve(ev.key)}
                    className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary/20 w-3 h-3"
                  />
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-gray-700 font-medium text-[10px] italic">{ev.nom}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute top-0 left-0 right-0 flex justify-between px-10 text-[10px] text-gray-400 font-semibold select-none z-10 pointer-events-none">
          {showTemp && <span>Température (°C)</span>}
          {showVp && <span>Valeur Pasteurisatrice (UP)</span>}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 25, right: 15, left: 0, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" vertical horizontal stroke="#eeeeee" />
            <XAxis
              dataKey="temps"
              type="number"
              domain={timeScale.domain}
              ticks={timeScale.ticks}
              tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace" }}
              axisLine={false}
              tickLine={{ stroke: "#d1d5db" }}
              interval={0}
              minTickGap={0}
              tickFormatter={(v) => `${v}`}
              label={{ value: `Durée (${timeUnit})`, position: "insideBottom", offset: -8, style: { fontSize: 9, fill: "#9ca3af", fontWeight: "bold" } }}
            />
            {showTemp && (
              <YAxis
                yAxisId="temp"
                tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={{ stroke: "#d1d5db" }}
                domain={temperatureScale.domain}
                ticks={temperatureScale.ticks}
                interval={0}
                allowDecimals={false}
                tickFormatter={(v) => `${v}°`}
              />
            )}
            {showVp && (
              <YAxis
                yAxisId="vp"
                orientation={showTemp ? "right" : "left"}
                type="number"
                domain={vpScale.domain}
                ticks={vpScale.ticks}
                tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={{ stroke: "#d1d5db" }}
                interval={0}
              />
            )}
            <Tooltip content={<CustomTooltip timeUnit={timeUnit} evaluations={evaluations} />} />

            {/* Temperature line */}
            {showTemp && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: "var(--color-primary)" }}
              />
            )}

            {/* Multi VP curves for Jus de Pomme */}
            {showVp && evaluations && evaluations.length > 0 ? (
              evaluations.map((ev) => {
                if (activeCurves[ev.key] === false) return null;
                const color = MICRO_COLORS[ev.key] || MICRO_COLORS.default;
                return (
                  <Line
                    key={ev.key}
                    yAxisId="vp"
                    type="monotone"
                    dataKey={`vp_${ev.key}`}
                    stroke={color}
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: color }}
                  />
                );
              })
            ) : (
              showVp && (
                <Line
                  yAxisId="vp"
                  type="monotone"
                  dataKey="vp_cumulee"
                  stroke="#dc2626"
                  strokeWidth={showTemp ? 1.5 : 2}
                  strokeDasharray={showTemp ? "6 3" : undefined}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: "#dc2626" }}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
