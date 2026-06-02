"use client";

import { useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";
import { useI18n } from "@/lib/i18n";

interface CourbeData {
  temps: number[];
  temperatures: number[];
  taux_letaux: number[];
  vp_cumulee: number[];
}

interface Props {
  courbe: CourbeData;
  tRef: number;
  vpCible: number;
  statut?: string;
  procede?: string | null;
}

const CustomTooltip = ({ active, payload, label, t, timeUnit }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-md border border-black/[0.06] shadow-sm text-[11px]">
      <p className="font-mono font-bold text-brand-text mb-1.5">{label} {timeUnit}</p>
      {data.temperature !== undefined && (
        <div className="flex justify-between gap-6">
          <span className="text-gray-400">{t("chart.temperature")}</span>
          <span className="font-mono font-bold text-brand-text">{data.temperature.toFixed(1)}°C</span>
        </div>
      )}
      {data.vp_cumulee !== undefined && (
        <div className="flex justify-between gap-6">
          <span className="text-gray-400">VP</span>
          <span className="font-mono font-bold text-gray-500">{data.vp_cumulee.toFixed(2)} UP</span>
        </div>
      )}
    </div>
  );
};

function buildData(courbe: CourbeData) {
  const n = Math.min(courbe.temps.length, courbe.temperatures.length, courbe.vp_cumulee.length);
  const out: Array<{ temps: number; temperature: number; vp_cumulee: number }> = [];
  for (let i = 0; i < n; i++) {
    const t = courbe.temps[i];
    const temp = courbe.temperatures[i];
    const vp = courbe.vp_cumulee[i];
    if (![t, temp, vp].every((v) => typeof v === "number" && Number.isFinite(v))) continue;
    out.push({ temps: t, temperature: temp, vp_cumulee: vp });
  }
  return out;
}

function buildTemperatureScale(data: ReturnType<typeof buildData>, tRef: number) {
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

function buildTimeScale(data: ReturnType<typeof buildData>) {
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

function buildVpScale(data: ReturnType<typeof buildData>, vpCible: number) {
  const values = data.map((d) => d.vp_cumulee);
  if (Number.isFinite(vpCible)) values.push(vpCible);

  const rawMax = Math.max(0, values.length ? Math.max(...values) : 0);
  let step = 1;
  if (rawMax > 200) step = 50;
  else if (rawMax > 100) step = 25;
  else if (rawMax > 50) step = 10;
  else if (rawMax > 20) step = 5;
  else if (rawMax > 10) step = 2;

  const max = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= max; tick += step) {
    ticks.push(tick);
  }

  return { domain: [0, max] as [number, number], ticks };
}

type ChartView = "temp" | "vp" | "both";

const STATUT_COLORS: Record<string, string> = {
  conforme: "var(--color-primary)",
  vigilance: "var(--color-accent)",
  insuffisant: "#dc2626",
};

export default function TemperatureChart({ courbe, tRef, vpCible, statut, procede }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<ChartView>("both");
  const data = buildData(courbe);
  const isFlash = procede?.toLowerCase().includes("flash");
  const timeUnit = isFlash ? "sec." : "min.";
  const temperatureScale = buildTemperatureScale(data, tRef);
  const timeScale = buildTimeScale(data);
  const vpScale = buildVpScale(data, vpCible);

  const showTemp = view === "temp" || view === "both";
  const showVp = view === "vp" || view === "both";
  const vpColor = "#dc2626"; // Always red for VP curve

  const views: { key: ChartView; label: string }[] = [
    { key: "temp", label: `${t("chart.temperature")} (°C)` },
    { key: "vp", label: "VP (UP)" },
    { key: "both", label: t("chart.bothCurves") },
  ];

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Toggle — pill switch */}
      <div className="flex items-center gap-1 bg-gray-100/80 rounded-md p-0.5 w-fit overflow-x-auto no-scrollbar max-w-full">
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

      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        {/* Unit labels at the top of the chart container to prevent overlaps and cutting */}
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
            {/* Left axis — temperature */}
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
            {/* Right axis — VP */}
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
            <Tooltip content={<CustomTooltip t={t} timeUnit={timeUnit} />} />

            {/* Reference lines */}
            {showTemp && (
              <ReferenceLine
                yAxisId="temp"
                y={tRef}
                stroke="var(--color-accent)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {showVp && (
              <ReferenceLine
                yAxisId="vp"
                y={vpCible}
                stroke={vpColor}
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}

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
            {/* VP line */}
            {showVp && (
              <Line
                yAxisId="vp"
                type="monotone"
                dataKey="vp_cumulee"
                stroke={showTemp ? vpColor : vpColor}
                strokeWidth={showTemp ? 1.5 : 2}
                strokeDasharray={showTemp ? "6 3" : undefined}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: vpColor }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
