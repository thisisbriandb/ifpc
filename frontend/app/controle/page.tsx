"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { Upload, ClipboardPaste, Keyboard, Loader2, FileSpreadsheet, ChevronRight, ChevronLeft, LayoutDashboard, Settings2, Table as TableIcon, X, Activity, AlertTriangle, CheckCircle, Plus, Trash2, HelpCircle, LogOut, User as UserIcon, Shield, Pencil, Save, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import ProductSelector from "@/components/ProductSelector";
import { KPICards } from "@/components/ResultDisplay";
import TemperatureChart from "@/components/TemperatureChart";
import { uploadFile, collerDonnees, getProductConfig, saveAnalysis, getAnalysisById, getHelpText, updateHelpText } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useSearchParams } from "next/navigation";
import AuthModal from "@/components/AuthModal";
import { useI18n } from "@/lib/i18n";

type InputMode = "upload" | "paste" | "manual";

interface RisqueData {
  niveau: string;
  score: number;
  couleur: string;
  conseil: string;
}

interface PasteurisationResult {
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
  courbe: {
    temps: number[];
    temperatures: number[];
    taux_letaux: number[];
    vp_cumulee: number[];
  };
}

export default function ControlePage() {
  return (
    <Suspense>
      <ControlePageInner />
    </Suspense>
  );
}

function ControlePageInner() {
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const defaultHelpText = t("controle.defaultHelp");

  // --- STATES METIER (inchangés) ---
  const [mode, setMode] = useState<InputMode>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PasteurisationResult | null>(null);
  const [expertMode, setExpertMode] = useState(false);

  const [productType, setProductType] = useState("jus_pomme");
  const [lotIdentifier, setLotIdentifier] = useState("");
  const [microorganisme, setMicroorganisme] = useState("");
  const [clarification, setClarification] = useState("trouble");
  const [procede, setProcede] = useState("classique");
  const [tRef, setTRef] = useState("");
  const [zValue, setZValue] = useState("");
  const [ph, setPh] = useState("");
  const [titreAlcool, setTitreAlcool] = useState("");

  const [vpCibleConfig, setVpCibleConfig] = useState<Record<string, number>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [helpContent, setHelpContent] = useState<string | null>(null);
  const [helpEditing, setHelpEditing] = useState(false);
  const [helpDraft, setHelpDraft] = useState("");
  const [helpSaving, setHelpSaving] = useState(false);
  const [helpPreview, setHelpPreview] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [manualData, setManualData] = useState("0\t20\n1\t35\n2\t50\n3\t60\n4\t68\n5\t72\n6\t72\n7\t72\n8\t65\n9\t50\n10\t30");
  const [manualRows, setManualRows] = useState<{temps: string; temp: string}[]>([
    {temps: "0", temp: "20"}, {temps: "1", temp: "35"}, {temps: "2", temp: "50"},
    {temps: "3", temp: "60"}, {temps: "4", temp: "68"}, {temps: "5", temp: "72"},
    {temps: "6", temp: "72"}, {temps: "7", temp: "72"}, {temps: "8", temp: "65"},
    {temps: "9", temp: "50"}, {temps: "10", temp: "30"},
  ]);

  // Sync manualData from grid rows
  const syncManualData = useCallback((rows: {temps: string; temp: string}[]) => {
    setManualData(rows.map(r => `${r.temps}\t${r.temp}`).join("\n"));
  }, []);

  const addRow = () => {
    const lastRow = manualRows[manualRows.length - 1];
    const nextTime = lastRow ? String(parseFloat(lastRow.temps || "0") + 1) : "0";
    const newRows = [...manualRows, { temps: nextTime, temp: "" }];
    setManualRows(newRows);
    syncManualData(newRows);
  };

  const removeRow = (idx: number) => {
    if (manualRows.length <= 2) return;
    const newRows = manualRows.filter((_, i) => i !== idx);
    setManualRows(newRows);
    syncManualData(newRows);
  };

  const updateRow = (idx: number, field: "temps" | "temp", value: string) => {
    const newRows = [...manualRows];
    newRows[idx] = { ...newRows[idx], [field]: value };
    setManualRows(newRows);
    syncManualData(newRows);
  };

  // --- STATES UI (Nouveaux) ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRawDataDrawerOpen, setIsRawDataDrawerOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // --- AUTH ---
  const { user, isLoading, checkAuth, logout } = useAuthStore();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch admin VP cible config
  useEffect(() => {
    getProductConfig()
      .then((data: { productType: string; vpCible: number }[]) => {
        const map: Record<string, number> = {};
        data.forEach(c => { map[c.productType] = c.vpCible; });
        setVpCibleConfig(map);
      })
      .catch(() => {});
  }, []);

  // Fetch help text when modal opens
  useEffect(() => {
    if (!showHelp) return;
    getHelpText("calcul_vp", locale)
      .then((res) => {
        if (res.content) setHelpContent(res.content);
        else setHelpContent(defaultHelpText);
      })
      .catch(() => {});
  }, [showHelp, locale, defaultHelpText]);

  const handleHelpSave = async () => {
    setHelpSaving(true);
    try {
      await updateHelpText("calcul_vp", helpDraft, locale);
      setHelpContent(helpDraft);
      setHelpEditing(false);
    } catch {
      // silently fail
    } finally {
      setHelpSaving(false);
    }
  };

  // Charger une analyse historique depuis localStorage ou ?history=ID
  useEffect(() => {
    // 1) Check localStorage restore (set by dashboard click)
    try {
      const restore = localStorage.getItem("ifpc_restore_result");
      if (restore) {
        localStorage.removeItem("ifpc_restore_result");
        const parsed = JSON.parse(restore);
        setResult(parsed);
        return;
      }
    } catch {}

    // 2) Fallback: fetch from Spring Boot API via ?history=ID
    const historyId = searchParams.get("history");
    if (!historyId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await getAnalysisById(parseInt(historyId, 10));
        if (cancelled) return;
        if (detail.resultJson) {
          const parsed = JSON.parse(detail.resultJson);
          setResult(parsed);
        }
      } catch {
        // 3) Last resort: try to find in localStorage activities
        try {
          const stored = localStorage.getItem("ifpc_recent_activities");
          if (stored) {
            const activities = JSON.parse(stored);
            const match = activities.find((a: any) => a.id === historyId);
            if (!cancelled && match?.resultJson) {
              setResult(JSON.parse(match.resultJson));
            }
          }
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  // --- LOGIQUE (inchangée) ---
  const buildParams = useCallback(() => {
    const params: Record<string, string | number | null> = {
      product_type: productType,
      clarification,
      procede,
    };
    if (microorganisme) params.microorganisme = microorganisme;
    if (tRef) params.t_ref = parseFloat(tRef);
    if (zValue) params.z = parseFloat(zValue);
    if (ph) params.ph = parseFloat(ph);
    if (titreAlcool) params.titre_alcool = parseFloat(titreAlcool);
    // Auto-apply VP cible from admin config
    if (vpCibleConfig[productType]) {
      params.vp_cible = vpCibleConfig[productType];
    }
    return params;
  }, [productType, microorganisme, clarification, procede, tRef, zValue, ph, titreAlcool, vpCibleConfig]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = buildParams();
      params.locale = locale;
      let res;
      if (mode === "upload") {
        if (!file) { setError(t("controle.errors.selectFile")); setLoading(false); return; }
        res = await uploadFile(file, params);
      } else if (mode === "paste") {
        if (!pasteText.trim()) { setError(t("controle.errors.pasteData")); setLoading(false); return; }
        res = await collerDonnees({ raw_text: pasteText, product_type: productType, locale, ...params });
      } else {
        if (!manualData.trim()) { setError(t("controle.errors.manualData")); setLoading(false); return; }
        res = await collerDonnees({ raw_text: manualData, product_type: productType, locale, ...params });
      }
      const enrichedResult = {
        ...res,
        parametres: {
          ...(res.parametres || {}),
          lot_identifier: lotIdentifier || undefined,
        },
      };
      setResult(enrichedResult);
      // --- Sauvegarder l'activité récente ---
      const activityLabel = lotIdentifier || res.parametres?.produit || file?.name || (mode === "paste" ? t("controle.pastedDataLabel") : t("controle.manualDataLabel"));
      try {
        // Sauvegarde persistante en base via Spring Boot
        await saveAnalysis({
          type: "controle",
          label: activityLabel,
          lotIdentifier: lotIdentifier || undefined,
          statut: enrichedResult.statut,
          vp: enrichedResult.vp,
          vpCible: enrichedResult.vp_cible,
          parametres: JSON.stringify(enrichedResult.parametres || {}),
          courbe: JSON.stringify(enrichedResult.courbe || {}),
          resultJson: JSON.stringify(enrichedResult),
        });
      } catch {
        // Fallback localStorage si le backend Spring est indisponible
      }
      try {
        const activity = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: "controle",
          label: activityLabel,
          lotIdentifier: lotIdentifier || undefined,
          produit: enrichedResult.parametres?.produit,
          procede: enrichedResult.parametres?.procede,
          statut: enrichedResult.statut,
          vp: enrichedResult.vp,
          vpCible: enrichedResult.vp_cible,
          resultJson: JSON.stringify(enrichedResult),
        };
        const stored = localStorage.getItem("ifpc_recent_activities");
        const existing = stored ? JSON.parse(stored) : [];
        const updated = [activity, ...existing].slice(0, 20);
        localStorage.setItem("ifpc_recent_activities", JSON.stringify(updated));
      } catch {}

      // Optionnel : fermer la sidebar d'input une fois le résultat obtenu pour laisser toute la place
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || t("controle.errors.unknown"));
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const modeConfig: Record<InputMode, { icon: any; label: string }> = {
    upload: { icon: Upload, label: t("controle.modeUpload") },
    paste: { icon: ClipboardPaste, label: t("controle.modePaste") },
    manual: { icon: Keyboard, label: t("controle.modeManual") },
  };

  return (
    <div className="h-screen flex bg-brand-gray font-sans text-brand-text overflow-hidden">

      {/* --- SIDEBAR GAUCHE --- */}
      <aside
        className={`${isSidebarOpen ? "w-[320px]" : "w-0"
          } transition-all duration-300 ease-in-out border-r border-black/[0.06] bg-white flex flex-col relative z-20`}
      >
        <div className={`${isSidebarOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-200 flex flex-col h-full overflow-hidden`}>

          <div className="flex-1 overflow-y-auto">
            {/* Product Parameters */}
            <div className="px-4 pt-4 pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-500">{t("controle.productSection")}</h3>
                {user && (user.role === 'EXPERT' || user.role === 'ADMIN') && (
                  <button
                    onClick={() => setExpertMode(!expertMode)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${expertMode ? "bg-brand-accent text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    EXPERT
                  </button>
                )}
              </div>
              <ProductSelector
                productType={productType} onProductChange={setProductType}
                microorganisme={microorganisme} onMicroChange={setMicroorganisme}
                procede={procede} onProcedeChange={setProcede}
                expertMode={expertMode}
                tRef={tRef} onTRefChange={setTRef}
                zValue={zValue} onZChange={setZValue}
                ph={ph} onPhChange={setPh}
                titreAlcool={titreAlcool} onTitreAlcoolChange={setTitreAlcool}
              />

              <div className="flex gap-1.5">
                {[[t("bareme.turbid"), "trouble"], [t("bareme.clear"), "limpide"]].map(([label, value]) => (
                  <button
                    key={value as string}
                    onClick={() => setClarification(value as string)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      clarification === value ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {label as string}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{t("controle.lotIdentifier")}</label>
                <input
                  type="text"
                  value={lotIdentifier}
                  onChange={(e) => setLotIdentifier(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-black/[0.06] rounded-md focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none text-xs bg-white"
                />
              </div>
            </div>

            <div className="mx-4 my-1 border-t border-black/[0.04]" />

            {/* Data input */}
            <div className="px-4 py-3">
              <h3 className="text-xs font-semibold text-gray-500 mb-3">{t("controle.dataSection")}</h3>
              <div className="flex p-0.5 bg-gray-100 rounded-md mb-3">
                {(Object.keys(modeConfig) as InputMode[]).map((m) => {
                  const Icon = modeConfig[m].icon;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${mode === m ? "bg-white text-brand-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                        }`}
                    >
                      <Icon className="w-3 h-3" />
                      {modeConfig[m].label}
                    </button>
                  );
                })}
              </div>

              {mode === "upload" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`border border-dashed rounded-lg p-5 text-center transition-all ${dragActive ? "border-brand-primary bg-brand-primary/5" : "border-black/[0.08] hover:border-brand-primary/30"
                    }`}
                >
                  {file ? (
                    <div className="text-sm">
                      <FileSpreadsheet className="w-8 h-8 text-brand-primary mx-auto mb-2" />
                      <p className="font-semibold text-brand-text truncate text-xs">{file.name}</p>
                      <button onClick={() => setFile(null)} className="text-[10px] text-red-500 hover:text-red-600 font-medium mt-2">{t("controle.removeFile")}</button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                      <label className="text-xs text-brand-primary font-bold cursor-pointer hover:underline">
                        {t("controle.browse")}
                        <input type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="text-[10px] text-gray-400 mt-1">{t("controle.dragDrop")}</p>
                    </div>
                  )}
                </div>
              )}

              {mode === "paste" && (
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={t("controle.inputPlaceholder")}
                  className="w-full h-36 px-3 py-2 bg-gray-50 border border-black/[0.06] rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-[11px] font-mono resize-none"
                />
              )}

              {mode === "manual" && (
                <div className="border border-black/[0.06] rounded-lg overflow-hidden">
                  <div className="max-h-44 overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 border-b border-black/[0.06]">
                          <th className="px-2 py-1.5 text-left font-bold text-gray-500 text-[9px] uppercase w-8">#</th>
                          <th className="px-2 py-1.5 text-left font-bold text-gray-500 text-[9px] uppercase">{t("controle.time")}</th>
                          <th className="px-2 py-1.5 text-left font-bold text-gray-500 text-[9px] uppercase">{t("controle.temp")}</th>
                          <th className="w-6"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {manualRows.map((row, idx) => (
                          <tr key={idx} className="group">
                            <td className="px-2 py-0.5 text-gray-300 font-mono">{idx + 1}</td>
                            <td className="px-1 py-0.5">
                              <input
                                type="text" inputMode="decimal" value={row.temps}
                                onChange={(e) => updateRow(idx, "temps", e.target.value)}
                                className="w-full px-1.5 py-0.5 border border-transparent focus:border-brand-primary rounded text-[11px] font-mono outline-none bg-transparent"
                              />
                            </td>
                            <td className="px-1 py-0.5">
                              <input
                                type="text" inputMode="decimal" value={row.temp}
                                onChange={(e) => updateRow(idx, "temp", e.target.value)}
                                className="w-full px-1.5 py-0.5 border border-transparent focus:border-brand-primary rounded text-[11px] font-mono outline-none bg-transparent"
                              />
                            </td>
                            <td className="px-0.5 py-0.5">
                              <button onClick={() => removeRow(idx)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500" title={t("controle.manualRowDelete")}>
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={addRow}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold text-brand-primary hover:bg-brand-primary/5 border-t border-black/[0.04]"
                  >
                    <Plus className="w-3 h-3" /> {t("controle.manualAddRow")}
                  </button>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full mt-3 py-2.5 text-sm flex items-center justify-center gap-2 rounded-lg font-bold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {loading ? t("controle.calculating") : t("controle.launchAnalysis")}
              </button>

              {error && (
                <div className="mt-3 bg-red-50/60 border border-red-200/30 rounded-lg p-3 text-red-600 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    {error.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? "mt-0.5 text-[10px] text-red-500" : ""}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-4 top-8 w-8 h-8 bg-white border border-black/[0.06] rounded-full flex items-center justify-center shadow-sm z-30 hover:bg-gray-50 transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>
      </aside>

      {/* --- MAIN CONTENT AREA (Dashboard) --- */}
      <main className="flex-1 overflow-y-auto relative bg-brand-gray">
        {/* Help button */}
        <button
          onClick={() => setShowHelp(true)}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-black/[0.06] rounded-lg text-xs font-semibold text-gray-400 hover:text-brand-primary hover:border-brand-primary/20 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          {t("controle.help")}
        </button>

        {result ? (
          <div className="max-w-4xl mx-auto p-6 lg:p-8 animate-in fade-in duration-500">

            {/* ── Header — product + lot ── */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-baseline gap-2 min-w-0">
                <h1 className="text-sm font-bold text-brand-text uppercase tracking-wide truncate">{result.parametres.produit}</h1>
                {result.parametres.lot_identifier && (
                  <span className="text-xs font-mono text-gray-400">#{result.parametres.lot_identifier}</span>
                )}
              </div>
              <button
                onClick={() => setIsRawDataDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-black/[0.06] rounded-md text-[10px] font-medium text-gray-400 hover:text-brand-text hover:border-black/[0.12] transition-colors"
              >
                <TableIcon className="w-3 h-3" />
                {t("controle.rawData")}
              </button>
            </div>

            {/* ── Decision block: verdict + metrics (tight) ── */}
            <KPICards result={result} />

            {/* ── Explanation: chart (separated) ── */}
            <div className="mt-8 bg-white rounded-lg border border-black/[0.06] overflow-hidden">
              <div className="px-5 py-3 border-b border-black/[0.04]">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t("controle.thermalKinetics")}</h3>
              </div>
              <div className="px-5 py-4 h-[360px]">
                <TemperatureChart
                  courbe={result.courbe}
                  tRef={result.parametres.t_ref}
                  vpCible={result.vp_cible}
                />
              </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">{t("controle.subtitleReady")}</p>
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
                >
                  {t("controle.openConfig")} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- LE DRAWER DES DONNÉES BRUTES (Pop-up) --- */}
      {isRawDataDrawerOpen && result && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Background Overlay */}
          <div
            className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity"
            onClick={() => setIsRawDataDrawerOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300">

            {/* Header du Pop-up */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-gray-400" />
                  {t("controle.rawDataTitle")}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t("controle.rawDataSubtitle", { n: result.courbe.temps.length })}
                </p>
              </div>
              <button
                onClick={() => setIsRawDataDrawerOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenu (Le tableau de données) */}
            <div className="flex-1 overflow-hidden p-6">
              <div className="h-full rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 shadow-sm z-10">
                      <tr>
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">{t("controle.time")} (min)</th>
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">{t("controle.temp")} (°C)</th>
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">{t("controle.rawDataVp")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {result.courbe.temps.map((t, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-2.5 font-mono text-gray-600">{t.toFixed(2)}</td>
                          <td className="px-5 py-2.5 font-mono font-medium text-gray-900">{result.courbe.temperatures[idx].toFixed(1)}</td>
                          <td className="px-5 py-2.5 font-mono text-brand-primary/80 font-medium">{result.courbe.vp_cumulee[idx].toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL D'AUTHENTIFICATION */}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}

      {/* HELP MODAL */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => { setShowHelp(false); setHelpEditing(false); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-primary" />
                {t("controle.helpTitle")}
              </h3>
              <div className="flex items-center gap-1">
                {user?.role === "ADMIN" && !helpEditing && (
                  <button
                    onClick={() => { setHelpEditing(true); setHelpDraft(helpContent || defaultHelpText); }}
                    title={t("controle.helpEdit")}
                    className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { setShowHelp(false); setHelpEditing(false); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {helpEditing ? (
              <div className="p-6 space-y-3">
                {/* Edit / Preview tabs */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                  <button
                    onClick={() => setHelpPreview(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      !helpPreview ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                    {t("controle.helpEditTab")}
                  </button>
                  <button
                    onClick={() => setHelpPreview(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      helpPreview ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    {t("controle.helpPreviewTab")}
                  </button>
                </div>

                {helpPreview ? (
                  <div className="min-h-[200px] border border-gray-200 rounded-xl p-4 prose prose-sm prose-gray max-w-none overflow-y-auto max-h-72">
                    <ReactMarkdown>{helpDraft}</ReactMarkdown>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400">{t("controle.helpMarkdownHint")}</p>
                    <textarea
                      value={helpDraft}
                      onChange={(e) => setHelpDraft(e.target.value)}
                      rows={13}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
                    />
                  </>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleHelpSave}
                    disabled={helpSaving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                  >
                    {helpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t("controle.helpSaved")}
                  </button>
                  <button
                    onClick={() => { setHelpEditing(false); setHelpPreview(false); }}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 prose prose-sm prose-gray max-w-none overflow-y-auto max-h-[60vh]">
                <ReactMarkdown>{helpContent || defaultHelpText}</ReactMarkdown>
              </div>
            )}

            {!helpEditing && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-full py-2.5 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
                >
                  {t("controle.helpDismiss")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
