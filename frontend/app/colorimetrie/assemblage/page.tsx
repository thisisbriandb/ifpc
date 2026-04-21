"use client";

import { useState, useRef } from "react";
import {
  Upload, FileSpreadsheet, X, Palette, Loader2,
  AlertCircle, Sparkles, Download, ChevronDown, Check,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { assemblageCouleur, saveAnalysis, AssemblageResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── ΔE interpretation (CIEDE2000 thresholds) ───────────────────────────────

function deltaQuality(de: number, t: (k: string) => string) {
  if (de < 1)  return { label: t("colori.deltaExcellent"),  cls: "bg-brand-primary/8 text-brand-primary border-brand-primary/15" };
  if (de < 3)  return { label: t("colori.deltaGood"),        cls: "bg-brand-primary/8 text-brand-primary border-brand-primary/15" };
  if (de < 6)  return { label: t("colori.deltaAcceptable"),  cls: "bg-brand-accent/8 text-brand-accent border-brand-accent/15" };
  return       { label: t("colori.deltaPoor"),               cls: "bg-red-500/10 text-red-700 border-red-500/20" };
}

// ── Compact swatch (tiny pill beside ΔE) ───────────────────────────────────

function MiniSwatch({ label, lab, hex }: { label: string; lab: { L: number; a: number; b: number }; hex: string }) {
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <div className="w-10 h-10 rounded-full border border-black/[0.08] shadow-sm shrink-0" style={{ backgroundColor: hex }} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="font-mono text-[11px] text-gray-500 tabular-nums leading-tight">
          {lab.L.toFixed(1)} · {lab.a.toFixed(1)} · {lab.b.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

// ── CSV template generator ─────────────────────────────────────────────────

function downloadCsvTemplate() {
  const rows: string[] = ["wavelength,Cuve A,Cuve B,Cuve C"];
  for (let wl = 380; wl <= 780; wl += 10) {
    // Synthetic realistic DO with gaussian absorption bumps
    const a = 0.30 + 0.20 * Math.exp(-Math.pow((wl - 440) / 50, 2));
    const b = 0.25 + 0.30 * Math.exp(-Math.pow((wl - 520) / 60, 2));
    const c = 0.20 + 0.35 * Math.exp(-Math.pow((wl - 650) / 70, 2));
    rows.push(`${wl},${a.toFixed(4)},${b.toFixed(4)},${c.toFixed(4)}`);
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "spectres_exemple.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AssemblagePage() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [targetL, setTargetL] = useState("85");
  const [targetA, setTargetA] = useState("4");
  const [targetB, setTargetB] = useState("35");
  const [volume, setVolume] = useState("1000");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssemblageResult | null>(null);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleFile = (f: File | null) => { setFile(f); setError(null); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError(t("colori.errorFileRequired")); return; }
    setError(null);
    setLoading(true);
    setSavedFlash(false);
    try {
      const target = {
        L: parseFloat(targetL) || 0,
        a: parseFloat(targetA) || 0,
        b: parseFloat(targetB) || 0,
      };
      const vol = Math.max(0, parseFloat(volume) || 0);
      const data = await assemblageCouleur(file, target, vol);
      setResult(data);
      setShowSpectrum(false);

      // Persist to history (fire-and-forget, silent failure)
      try {
        await saveAnalysis({
          type: "assemblage",
          label: `Assemblage L*${target.L} a*${target.a} b*${target.b}`,
          statut: data.delta_e < 3 ? "REUSSI" : data.delta_e < 6 ? "ACCEPTABLE" : "ECART",
          vp: data.delta_e,
          parametres: JSON.stringify({ target, volume_total: vol, file: file.name }),
          resultJson: JSON.stringify(data),
        });
        setSavedFlash(true);
      } catch { /* pas bloquant */ }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "unknown";
      setError(t("colori.errorComputation", { msg }));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? result.spectre.wavelengths.map((wl, i) => {
        const row: any = { wl, mix: result.spectre.do_mix[i] };
        result.spectre.do_cuves.forEach((arr, idx) => { row[`cuve_${idx}`] = arr[i]; });
        return row;
      })
    : [];

  const quality = result ? deltaQuality(result.delta_e, t) : null;

  return (
    <div className="min-h-screen bg-brand-gray">
      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">

        {/* ── Header ── */}
        <header className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center shrink-0 mt-0.5">
            <Palette className="w-5 h-5 text-brand-accent" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brand-text font-clash">{t("colori.title")}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t("colori.subtitle")}</p>
          </div>
        </header>

        {/* ── Configuration form ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
          <div className="px-6 py-6 space-y-6">

            {/* STEP 1 — Upload */}
            <section>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                  <p className="text-[11px] font-bold text-gray-600">{t("colori.stepSpectra")}</p>
                </div>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-brand-primary transition-colors"
                >
                  <Download className="w-3 h-3" />
                  {t("colori.downloadTemplate")}
                </button>
              </div>

              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl px-5 py-8 text-center cursor-pointer transition-colors ${
                    dragActive
                      ? "border-brand-accent bg-brand-accent/5"
                      : "border-gray-200 hover:border-brand-accent/50 hover:bg-gray-50/50"
                  }`}
                >
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-brand-text">{t("colori.uploadCta")}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{t("colori.dropHint")}</p>
                  <p className="text-[11px] text-gray-400 mt-3 max-w-sm mx-auto leading-relaxed">
                    {t("colori.uploadHint")}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-accent/20 bg-brand-accent/5">
                  <FileSpreadsheet className="w-5 h-5 text-brand-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t("colori.fileSelected")}</p>
                    <p className="text-sm font-semibold text-brand-text truncate">{file.name}</p>
                  </div>
                  <button type="button" onClick={() => handleFile(null)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv,.txt"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </section>

            {/* STEP 2 — Target Lab + Volume */}
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                <p className="text-[11px] font-bold text-gray-600">{t("colori.stepTarget")}</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: t("colori.targetL"), value: targetL, set: setTargetL, step: "0.1", min: "0", max: "100", suffix: "" },
                  { label: t("colori.targetA"), value: targetA, set: setTargetA, step: "0.1", suffix: "" },
                  { label: t("colori.targetB"), value: targetB, set: setTargetB, step: "0.1", suffix: "" },
                  { label: t("colori.volume"), value: volume, set: setVolume, step: "10", min: "1", suffix: t("colori.volumeUnit") },
                ].map((f, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-gray-400 mb-1 truncate">{f.label}</p>
                    <div className="relative">
                      <input
                        type="number"
                        step={f.step}
                        min={f.min}
                        max={f.max}
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        className={`w-full px-3 py-2 border border-black/[0.06] rounded-lg text-sm font-mono text-brand-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/5 transition-colors ${
                          f.suffix ? "pr-7" : ""
                        }`}
                      />
                      {f.suffix && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono pointer-events-none">
                          {f.suffix}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-200/60 bg-red-50 text-red-700 text-[12px] leading-relaxed">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-3 bg-gray-50/60 border-t border-black/[0.04] flex justify-end">
            <button
              type="submit"
              disabled={loading || !file}
              className="flex items-center gap-2 px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loading ? t("colori.computing") : t("colori.compute")}
            </button>
          </div>
        </form>

        {/* ── Results ── */}
        {result && quality ? (
          <>
            {/* ══ BLOC 1 — HERO RECIPE (big numbers) ══ */}
            <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between gap-3 border-b border-black/[0.04]">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("colori.recipeTitle")}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t("colori.for")} <span className="font-bold font-mono text-brand-text">{result.volume_total.toLocaleString()} {t("colori.volumeUnit")}</span>
                  </p>
                </div>
                {savedFlash && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-primary">
                    <Check className="w-3 h-3" />
                    {t("colori.saved")}
                  </span>
                )}
              </div>

              <div className="px-6 py-6 space-y-4">
                {result.proportions.map((p, i) => {
                  const cuve = result.cuves[i];
                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full border border-black/[0.08] shrink-0"
                            style={{ backgroundColor: cuve.hex }}
                          />
                          <span className="text-sm font-semibold text-brand-text truncate">{p.nom}</span>
                        </div>
                        <div className="flex items-baseline gap-3 shrink-0">
                          <span className="text-2xl font-bold font-mono text-brand-text tabular-nums leading-none">
                            {p.pct.toFixed(1)}
                            <span className="text-sm text-gray-400 ml-0.5">%</span>
                          </span>
                          <span className="text-[13px] font-semibold font-mono text-gray-500 tabular-nums">
                            {p.litres.toLocaleString()} {t("colori.volumeUnit")}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${p.pct}%`, backgroundColor: cuve.hex }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ══ BLOC 2 — COMPACT COMPARATOR (target vs simulated + ΔE) ══ */}
            <div className="bg-white rounded-2xl border border-black/[0.06] px-5 py-4 flex items-center gap-4">
              <MiniSwatch label={t("colori.target")} lab={result.cible} hex={result.cible.hex} />
              <div className="flex flex-col items-center gap-0.5 shrink-0 px-3 border-x border-black/[0.05]">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">ΔE</span>
                <span className="text-xl font-bold font-mono text-brand-text tabular-nums leading-none my-0.5">
                  {result.delta_e.toFixed(2)}
                </span>
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${quality.cls}`}>
                  {quality.label}
                </span>
              </div>
              <MiniSwatch label={t("colori.simulated")} lab={result.obtenu} hex={result.obtenu.hex} />
            </div>

            {/* ══ BLOC 3 — COLLAPSIBLE SPECTRUM ══ */}
            <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSpectrum((v) => !v)}
                className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors"
              >
                <div className="text-left">
                  <p className="text-[11px] font-bold text-gray-600">{t("colori.spectrum")}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t("colori.deltaMethod")}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSpectrum ? "rotate-180" : ""}`} />
              </button>

              {showSpectrum && (
                <div className="px-6 pb-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                        <XAxis
                          dataKey="wl"
                          tick={{ fontSize: 10, fill: "#9ca3af", fontFamily: "monospace" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}`}
                          minTickGap={30}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#9ca3af", fontFamily: "monospace" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}
                          formatter={(v: any) => (typeof v === "number" ? v.toFixed(3) : v)}
                          labelFormatter={(l) => `${l} nm`}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
                        {result.cuves.map((c, i) => (
                          <Line
                            key={i}
                            type="monotone"
                            dataKey={`cuve_${i}`}
                            name={c.nom}
                            stroke={c.hex}
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            dot={false}
                          />
                        ))}
                        <Line
                          type="monotone"
                          dataKey="mix"
                          name={t("colori.mixture")}
                          stroke="#1a5f3f"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-2">{t("colori.wavelength")}</p>
                </div>
              )}
            </div>
          </>
        ) : !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center">
            <Palette className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{t("colori.emptyState")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
