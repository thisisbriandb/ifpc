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

  // Extract all "temps" points to set as explicit ticks so every step is drawn on the axis
  const tempsTicks = data.map(d => d.temps);

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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
            <XAxis
              dataKey="temps"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={tempsTicks}
              tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
              label={{ value: `Durée (${timeUnit})`, position: "insideBottom", offset: -8, style: { fontSize: 9, fill: "#9ca3af", fontWeight: "bold" } }}
            />
            {/* Left axis — temperature */}
            {showTemp && (
              <YAxis
                yAxisId="temp"
                tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                domain={[(min: number) => Math.floor(min - 5), (max: number) => Math.ceil(max + 5)]}
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
                domain={[0, "auto"]}
                tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
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
