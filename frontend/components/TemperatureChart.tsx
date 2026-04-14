"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
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

function fmtNumber(n: unknown, digits = 2) {
  const x = typeof n === "number" && Number.isFinite(n) ? n : NaN;
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}

const CustomTooltip = ({ active, payload, label, t }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-100 min-w-[150px]">
        <p className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-50 pb-2">{t("chart.timeMinutes", { n: label })}</p>
        <div className="flex flex-col gap-2">
          {data.temperature !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs flex items-center gap-1.5 font-semibold text-gray-500">
                <span className="w-2 h-2 rounded-full bg-brand-primary"></span>
                {t("chart.temperature")}
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>{data.temperature.toFixed(1)} °C</span>
            </div>
          )}
          {data.vp_cumulee !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs flex items-center gap-1.5 font-semibold text-gray-500">
                <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
                {t("chart.cumulativeVp")}
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--color-accent)" }}>{data.vp_cumulee.toFixed(2)} UP</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
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

export default function TemperatureChart({ courbe, tRef, vpCible }: Props) {
  const { t } = useI18n();
  const data = buildData(courbe);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Courbe de température */}
      {/* Courbe de température */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("chart.thermalKinetics")}</h4>
    <div className="flex gap-4">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-primary"></span>
        <span className="text-[10px] font-bold text-gray-500 uppercase">{t("chart.temperature")}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
        <span className="text-[10px] font-bold text-gray-500 uppercase">{t("chart.tref")}</span>
      </div>
    </div>
  </div>
  
  <div className="h-[300px] w-full bg-white rounded-xl p-2 shadow-sm"> {/* fond blanc et ombre légère */}
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" /> {/* grille plus claire */}
        <XAxis 
          dataKey="temps" 
          tick={{ fontSize: 10, fill: "#9ca3af" }} 
          axisLine={false} 
          tickLine={false}
          tickFormatter={(v) => t("chart.minutesShort", { n: v })}
          minTickGap={30}
        />
        <YAxis 
          yAxisId="temp" 
          tick={{ fontSize: 10, fill: "#9ca3af" }} 
          axisLine={false} 
          tickLine={false}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<CustomTooltip t={t} />} />
        <ReferenceLine 
          yAxisId="temp" 
          y={tRef} 
          stroke="var(--color-accent)" 
          strokeDasharray="5 5" 
          label={{ value: t("chart.trefLabel", { n: tRef }), position: 'insideTopRight', fill: 'var(--color-accent)', fontSize: 10, fontWeight: 'bold' }} 
        />
        <Area 
          yAxisId="temp" 
          type="monotone" 
          dataKey="temperature" 
          stroke="var(--color-primary)" 
          strokeWidth={2.5}
          fill="url(#tempGradient)" 
          dot={{ r: 2, fill: "var(--color-primary)", strokeWidth: 0 }}
          activeDot={{ r: 4, strokeWidth: 0, fill: "var(--color-primary)" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
</div>

      {/* Courbe de VP cumulée */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("chart.vpAccumulation")}</h4>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">{t("chart.cumulativeVp")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">{t("chart.target")}</span>
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full bg-white shadow-sm rounded-xl p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="vpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="temps" 
                tick={{ fontSize: 10, fill: "#9ca3af" }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(v) => t("chart.minutesShort", { n: v })}
                minTickGap={30}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "#9ca3af" }} 
                axisLine={false} 
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip t={t} />} />
              <ReferenceLine 
                y={vpCible} 
                stroke="#ef4444" 
                strokeDasharray="5 5" 
                label={{ value: t("chart.targetLabel", { n: vpCible }), position: 'insideTopRight', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} 
              />
              <Area 
                type="monotone" 
                dataKey="vp_cumulee" 
                stroke="var(--color-accent)" 
                strokeWidth={2.5}
                fill="url(#vpGradient)" 
                dot={{ r: 2, fill: "var(--color-accent)", strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0, fill: "var(--color-accent)" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
