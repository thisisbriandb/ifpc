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

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_10px_30px_rgba(17,24,39,0.06)]">
      <header className="flex items-start justify-between gap-6 px-6 pt-6">
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-900">
            {title}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{subtitle}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#84A44A]/90" />
          <span className="text-xs text-gray-500">Mesure</span>
        </div>
      </header>

      <div className="px-2 pb-3 pt-4 sm:px-4">
        <div className="rounded-xl bg-gradient-to-b from-gray-50 to-white p-3 sm:p-4">
          {children}
        </div>
      </div>
    </section>
  );
}

export default function TemperatureChart({ courbe, tRef, vpCible }: Props) {
  const data = buildData(courbe);

  return (
    <div className="space-y-6">
      {/* Courbe de température */}
      <Card
        title="Cinétique thermique"
        subtitle="Évolution de la température en fonction du temps, avec repère Tref."
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 16, left: 6, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="4 10" stroke="#e5e7eb" />
            <XAxis
              dataKey="temps"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(v) => fmtNumber(v, 2)}
            />
            <YAxis
              yAxisId="temp"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={44}
            />

            <Tooltip
              cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid rgba(229,231,235,1)",
                boxShadow: "0 20px 40px rgba(17,24,39,0.10)",
                padding: "10px 12px",
              }}
              labelStyle={{ color: "#111827", fontWeight: 600 }}
              formatter={(value: unknown, name: string) => {
                if (name === "Température") {
                  const v = typeof value === "number" ? value : Number(value);
                  return [`${fmtNumber(v, 1)} °C`, "Température"];
                }
                return [String(value), name];
              }}
              labelFormatter={(label) => `t = ${fmtNumber(label, 2)} min`}
              separator=" : "
            />

            <ReferenceLine
              yAxisId="temp"
              y={tRef}
              stroke="#F19B13"
              strokeDasharray="6 6"
              strokeWidth={1.6}
              label={{
                value: `Tref ${fmtNumber(tRef, 1)}°C`,
                fill: "#B45309",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />

            <Area
              yAxisId="temp"
              type="monotone"
              dataKey="temperature"
              name="Température"
              stroke="#84A44A"
              strokeWidth={2.25}
              fill="#84A44A"
              fillOpacity={0.14}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-3 flex flex-wrap gap-2 px-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-[#84A44A]" />
            Température
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-xs text-amber-800">
            <span className="h-2 w-2 rounded-full bg-[#F19B13]" />
            Tref
          </span>
        </div>
      </Card>

      {/* Courbe de VP cumulée */}
      <Card
        title="Accumulation de la VP"
        subtitle="VP cumulée au cours du temps, avec repère de la cible."
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 16, left: 6, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="4 10" stroke="#e5e7eb" />
            <XAxis
              dataKey="temps"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(v) => fmtNumber(v, 2)}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={54}
              domain={[
                0,
                (dataMax: number) => Math.max(dataMax * 1.1, vpCible * 1.2),
              ]}
              tickFormatter={(v) => fmtNumber(v, 0)}
            />

            <Tooltip
              cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid rgba(229,231,235,1)",
                boxShadow: "0 20px 40px rgba(17,24,39,0.10)",
                padding: "10px 12px",
              }}
              labelStyle={{ color: "#111827", fontWeight: 600 }}
              formatter={(value: unknown) => {
                const v = typeof value === "number" ? value : Number(value);
                return [`${fmtNumber(v, 2)} UP`, "VP cumulée"];
              }}
              labelFormatter={(label) => `t = ${fmtNumber(label, 2)} min`}
              separator=" : "
            />

            <ReferenceLine
              y={vpCible}
              stroke="#E53E3E"
              strokeWidth={2}
              strokeDasharray="10 6"
              label={{
                value: `VP cible ${fmtNumber(vpCible, 2)} UP`,
                fill: "#991B1B",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />

            <Area
              type="monotone"
              dataKey="vp_cumulee"
              name="VP cumulée"
              stroke="#84A44A"
              strokeWidth={2.5}
              fill="#84A44A"
              fillOpacity={0.18}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-3 flex flex-wrap gap-2 px-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-[#84A44A]" />
            VP cumulée
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-red-200/70 bg-red-50 px-3 py-1 text-xs text-red-800">
            <span className="h-2 w-2 rounded-full bg-[#E53E3E]" />
            Cible
          </span>
        </div>
      </Card>
    </div>
  );
}