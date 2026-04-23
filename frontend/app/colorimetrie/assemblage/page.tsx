"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload, FileSpreadsheet, X, Palette, Loader2,
  AlertCircle, Sparkles, Download, ChevronDown, Check,
  Info, Beaker, Zap, BarChart3, Binary
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { assemblageCouleur, assemblageCouleurDb, saveAnalysis, getCuves, updateCuve, AssemblageResult, type Cuve } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── ΔE interpretation ──────────────────────────────────────────────────────

function deltaQuality(de: number, t: (k: string) => string) {
  if (de < 1)  return { label: t("colori.deltaExcellent"),  cls: "bg-brand-primary/10 text-brand-primary border-brand-primary/20" };
  if (de < 3)  return { label: t("colori.deltaGood"),        cls: "bg-brand-primary/10 text-brand-primary border-brand-primary/20" };
  if (de < 6)  return { label: t("colori.deltaAcceptable"),  cls: "bg-brand-accent/10 text-brand-accent border-brand-accent/20" };
  return       { label: t("colori.deltaPoor"),               cls: "bg-red-500/10 text-red-700 border-red-500/20" };
}

// ── Metadata Chip Component ────────────────────────────────────────────────

function MetaChip({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/[0.03] border border-black/[0.05] text-[10px] font-bold text-gray-500 uppercase tracking-wider">
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

// ── CSV template generator ─────────────────────────────────────────────────

function downloadCsvTemplate() {
  const rows: string[] = ["wavelength,Cuve A,Cuve B,Cuve C"];
  for (let wl = 380; wl <= 780; wl += 10) {
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
  const [volume, setVolume] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssemblageResult | null>(null);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // DB selection state
  const [useDb, setUseDb] = useState(false);
  const [dbCuves, setDbCuves] = useState<Cuve[]>([]);
  const [selectedCuveIds, setSelectedCuvesIds] = useState<number[]>([]);
  const [savingToDb, setSavingToDb] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (useDb) {
      getCuves().then(data => setDbCuves(data.filter(c => !!c.spectrumJson))).catch(() => {});
    }
  }, [useDb]);

  const handleFile = (f: File | null) => { setFile(f); setError(null); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useDb && !file) { setError(t("colori.errorFileRequired")); return; }
    if (useDb && selectedCuveIds.length === 0) { setError("Veuillez sélectionner au moins une cuve."); return; }
    
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
      
      let data;
      if (useDb) {
        const selected = dbCuves.filter(c => selectedCuveIds.includes(c.id!));
        // On suppose que tous les spectres ont les mêmes longueurs d'onde
        const firstSpec = JSON.parse(selected[0].spectrumJson!);
        data = await assemblageCouleurDb({
          wavelengths: firstSpec.wavelengths,
          names: selected.map(c => c.nom),
          do_matrix_list: selected.map(c => JSON.parse(c.spectrumJson!).do),
          target_L: target.L,
          target_a: target.a,
          target_b: target.b,
          volume_total: vol,
        });
      } else {
        data = await assemblageCouleur(file!, target, vol);
      }
      
      setResult(data);
      setShowSpectrum(false);

      try {
        await saveAnalysis({
          type: "assemblage",
          label: `Assemblage L*${target.L} a*${target.a} b*${target.b}`,
          statut: data.delta_e < 3 ? "REUSSI" : data.delta_e < 6 ? "ACCEPTABLE" : "ECART",
          vp: data.delta_e,
          parametres: JSON.stringify({ target, volume_total: vol, file: file?.name }),
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

  const saveCuveToDb = async (idx: number) => {
    if (!result) return;
    const c = result.cuves[idx];
    const spec = {
      wavelengths: result.spectre.wavelengths,
      do: result.spectre.do_cuves[idx]
    };
    
    setSavingToDb(prev => ({ ...prev, [c.nom]: true }));
    try {
      const all = await getCuves();
      const existing = all.find(tank => tank.nom === c.nom);
      
      if (existing && existing.id) {
        await updateCuve(existing.id, {
          ...existing,
          colorL: c.L,
          colorA: c.a,
          colorB: c.b,
          colorHex: c.hex,
          spectrumJson: JSON.stringify(spec)
        });
        alert(`Cuve "${c.nom}" mise à jour.`);
      } else {
        alert(`Aucune cuve nommée "${c.nom}" trouvée en base. Créez-la d'abord dans l'onglet Gestion de cuves.`);
      }
    } catch (err) {
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSavingToDb(prev => ({ ...prev, [c.nom]: false }));
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
      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── Header ── */}
        <header className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-accent/10 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-brand-accent" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-text font-clash tracking-tight">{t("colori.title")}</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{t("colori.subtitle")}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">

          {/* ══ NIVEAU 2 — INPUTS (Colonne Gauche) ══ */}
          <aside className="lg:col-span-4 space-y-6 order-2 lg:order-1">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* CIELAB Manuel */}
              <div className="bg-white rounded-2xl border border-black/[0.06] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">{t("colori.stepTarget")}</p>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "L*", value: targetL, set: setTargetL, min: "0", max: "100" },
                      { label: "a*", value: targetA, set: setTargetA },
                      { label: "b*", value: targetB, set: setTargetB },
                    ].map((f, i) => (
                      <div key={i}>
                        <p className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase ml-1">{f.label}</p>
                        <input
                          type="number" step="0.1" min={f.min} max={f.max}
                          value={f.value} onChange={(e) => f.set(e.target.value)}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-black/[0.04] rounded-xl text-sm font-mono text-brand-text outline-none focus:ring-2 focus:ring-brand-primary/10 focus:bg-white transition-all"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase ml-1">{t("colori.volume")}</p>
                    <div className="relative">
                      <input
                        type="number" step="10" min="1"
                        placeholder="Optionnel"
                        value={volume} onChange={(e) => setVolume(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-black/[0.04] rounded-xl text-sm font-mono text-brand-text outline-none focus:ring-2 focus:ring-brand-primary/10 focus:bg-white transition-all pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">{t("colori.volumeUnit")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Import Fichier / DB toggle */}
              <div className="bg-white rounded-2xl border border-black/[0.06] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                    <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">{t("colori.stepSpectra")}</p>
                  </div>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg">
                    <button type="button" onClick={() => setUseDb(false)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${!useDb ? 'bg-white shadow-sm' : 'text-gray-400'}`}>FICHIER</button>
                    <button type="button" onClick={() => setUseDb(true)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${useDb ? 'bg-white shadow-sm' : 'text-gray-400'}`}>BASE</button>
                  </div>
                </div>

                {useDb ? (
                  <div className="space-y-3">
                    {dbCuves.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-4 text-center">Aucune cuve avec spectre trouvée.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {dbCuves.map(c => (
                          <label key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent has-[:checked]:border-brand-accent/20 has-[:checked]:bg-brand-accent/5">
                            <input
                              type="checkbox"
                              checked={selectedCuveIds.includes(c.id!)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCuvesIds(prev => [...prev, c.id!]);
                                else setSelectedCuvesIds(prev => prev.filter(id => id !== c.id));
                              }}
                              className="w-4 h-4 rounded accent-brand-accent"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-700 truncate">{c.nom}</p>
                              <p className="text-[10px] text-gray-400 truncate">{c.lotIdentifier || c.typeProduit}</p>
                            </div>
                            {c.colorHex && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.colorHex }} />}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {!file ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                          dragActive ? "border-brand-accent bg-brand-accent/5" : "border-gray-100 hover:border-brand-accent/40 hover:bg-gray-50/50"
                        }`}
                      >
                        <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-brand-text">{t("colori.uploadCta")}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{t("colori.dropHint")}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-accent/5 border border-brand-accent/10">
                        <FileSpreadsheet className="w-5 h-5 text-brand-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-brand-text truncate">{file?.name}</p>
                          <p className="text-[9px] text-brand-accent/60 uppercase font-bold tracking-wider">{t("colori.fileSelected")}</p>
                        </div>
                        <button type="button" onClick={() => handleFile(null)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-3">
                      <button type="button" onClick={downloadCsvTemplate} className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-brand-primary transition-colors">
                        <Download className="w-3 h-3" /> {t("colori.downloadTemplate")}
                      </button>
                    </div>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.tsv,.txt" onChange={(e) => handleFile(e.target.files?.[0] || null)} className="hidden" />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-[11px] font-medium leading-relaxed border border-red-100">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (!useDb && !file) || (useDb && selectedCuveIds.length === 0)}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? t("colori.computing") : t("colori.compute")}
              </button>
            </form>

            {/* Metadata Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              <MetaChip icon={Info} label="CIE 1931 2°" />
              <MetaChip icon={Zap} label="Illuminant D65" />
              <MetaChip icon={Binary} label="10nm Step" />
              <MetaChip icon={Beaker} label="Beer-Lambert" />
            </div>
          </aside>

          {/* ══ NIVEAUX 3 & 4 — RÉSULTATS & ANALYSE (Colonne Droite) ══ */}
          <main className="lg:col-span-8 space-y-6 sm:space-y-8 order-1 lg:order-2">
            {result && quality ? (
              <>
                {/* NIVEAU 3 — RESULTATS (VERDICT) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
                  {/* Comparaison Visuelle */}
                  <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden flex flex-col shadow-sm">
                    <div className="flex flex-1 min-h-[140px]">
                      <div className="flex-1 flex flex-col items-center justify-center relative group" style={{ backgroundColor: result.cible.hex }}>
                        <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity">Cible</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center relative group" style={{ backgroundColor: result.obtenu.hex }}>
                        <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity">Simulé</span>
                      </div>
                    </div>
                    <div className="px-5 py-3 bg-gray-50 border-t border-black/[0.04] flex justify-between items-center">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("colori.target")} vs {t("colori.simulated")}</p>
                       <div className="flex gap-2">
                          <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: result.cible.hex }} />
                          <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: result.obtenu.hex }} />
                       </div>
                    </div>
                  </div>

                  {/* Recette rapide + ΔE */}
                  <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-sm relative">
                    <div className="absolute top-0 right-0 p-4">
                      {savedFlash && <Check className="w-4 h-4 text-brand-primary opacity-50" />}
                    </div>
                    <div className="px-5 py-3 border-b border-black/[0.04] bg-gray-50/50">
                      <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
                        {t("colori.recipeTitle")}
                        {result.volume_total > 0 && ` (${result.volume_total.toLocaleString()} ${t("colori.volumeUnit")})`}
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      {result.proportions.map((p, i) => {
                        const cuve = result.cuves[i];
                        return (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-between items-end">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-3 h-3 rounded-full shrink-0 shadow-inner" style={{ backgroundColor: cuve.hex }} />
                                <span className="text-[11px] font-bold text-brand-text truncate">{p.nom}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {!useDb && (
                                  <button
                                    type="button"
                                    onClick={() => saveCuveToDb(i)}
                                    disabled={savingToDb[p.nom]}
                                    title="Mettre à jour la cuve en base"
                                    className="text-[9px] font-bold text-brand-primary hover:underline disabled:opacity-50"
                                  >
                                    {savingToDb[p.nom] ? "..." : "SAUVER DB"}
                                  </button>
                                )}
                                <span className="text-xs font-black font-mono text-brand-text">{p.pct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.pct}%`, backgroundColor: cuve.hex }} />
                            </div>
                            {result.volume_total > 0 && (
                              <p className="text-[10px] font-bold text-gray-400 font-mono text-right">{p.litres.toLocaleString()} {t("colori.volumeUnit")}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-3 border-t border-black/[0.04] bg-gray-50/50 flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black font-mono text-brand-text tabular-nums leading-none">{result.delta_e.toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-gray-300">ΔE</span>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${quality.cls}`}>
                        {quality.label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* NIVEAU 4 — ANALYSE DÉTAILLÉE */}
                <div className="space-y-6">
                  
                  {/* Tableau de comparaison */}
                

                  {/* Graphe Spectral */}
                  <div className="bg-white rounded-2xl border border-black/[0.06] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">{t("colori.spectrum")}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{t("colori.deltaMethod")}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-0.5 bg-[#1a5f3f]" />
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{t("colori.mixture")}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="h-64 sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f3f3" />
                          <XAxis dataKey="wl" tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace", fontWeight: 700 }} axisLine={false} tickLine={false} minTickGap={30} />
                          <YAxis tick={{ fontSize: 9, fill: "#9ca3af", fontFamily: "monospace", fontWeight: 700 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
                          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} iconType="circle" />
                          {result.cuves.map((c, i) => (
                            <Line key={i} type="monotone" dataKey={`cuve_${i}`} name={c.nom} stroke={c.hex} strokeWidth={1.5} strokeDasharray="5 5" dot={false} opacity={0.4} />
                          ))}
                          <Line type="monotone" dataKey="mix" name={t("colori.mixture")} stroke="#1a5f3f" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[9px] font-bold text-gray-300 text-center mt-4 uppercase tracking-[0.2em]">{t("colori.wavelength")} (NM)</p>
                  </div>
                </div>
              </>
            ) : !loading && (
              <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 p-8 sm:p-12 text-center shadow-inner min-h-[300px]">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                   <Palette className="w-6 h-6 sm:w-8 sm:h-8 text-gray-200" />
                </div>
                <p className="text-sm font-bold text-brand-text">{t("colori.emptyState")}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[240px] leading-relaxed mx-auto">
                   {"Configurez les paramètres "}
                   {typeof window !== "undefined" && window.innerWidth < 1024 ? "ci-dessous" : "à gauche"}
                   {" pour lancer la simulation d'assemblage."}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
