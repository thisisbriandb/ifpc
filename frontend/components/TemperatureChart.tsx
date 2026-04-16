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
}

const CustomTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-md border border-black/[0.06] shadow-sm text-[11px]">
      <p className="font-mono font-bold text-brand-text mb-1.5">{label} min</p>
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

export default function TemperatureChart({ courbe, tRef, vpCible }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<ChartView>("both");
  const data = buildData(courbe);

  const showTemp = view === "temp" || view === "both";
  const showVp = view === "vp" || view === "both";

  const views: { key: ChartView; label: string }[] = [
    { key: "temp", label: `${t("chart.temperature")} (°C)` },
    { key: "vp", label: "VP (UP)" },
    { key: "both", label: t("chart.bothCurves") },
  ];

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Toggle — pill switch */}
      <div className="flex items-center gap-1 bg-gray-100/80 rounded-md p-0.5 w-fit">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
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
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
            <XAxis
              dataKey="temps"
              tick={{ fontSize: 10, fill: "#9ca3af", fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}′`}
              minTickGap={30}
            />
            {/* Left axis — temperature */}
            {showTemp && (
              <YAxis
                yAxisId="temp"
                tick={{ fontSize: 10, fill: "#9ca3af", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${v}°`}
                label={{ value: "°C", position: "insideTopLeft", offset: 10, style: { fontSize: 10, fill: "#9ca3af", fontFamily: "monospace" } }}
              />
            )}
            {/* Right axis — VP */}
            {showVp && (
              <YAxis
                yAxisId="vp"
                orientation={showTemp ? "right" : "left"}
                tick={{ fontSize: 10, fill: "#9ca3af", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                label={{ value: "UP", position: showTemp ? "insideTopRight" : "insideTopLeft", offset: 10, style: { fontSize: 10, fill: "#9ca3af", fontFamily: "monospace" } }}
              />
            )}
            <Tooltip content={<CustomTooltip t={t} />} />

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
                stroke="var(--color-danger)"
                strokeDasharray="4 4"
                strokeWidth={1}
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
                stroke={showTemp ? "#9ca3af" : "var(--color-primary)"}
                strokeWidth={showTemp ? 1.5 : 2}
                strokeDasharray={showTemp ? "6 3" : undefined}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: showTemp ? "#9ca3af" : "var(--color-primary)" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
