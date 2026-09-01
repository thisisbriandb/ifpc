"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { Upload, ClipboardPaste, Keyboard, Loader2, FileSpreadsheet, ChevronRight, ChevronLeft, Settings2, Table as TableIcon, X, Activity, AlertTriangle, Plus, Trash2, HelpCircle, RotateCcw } from "lucide-react";
import ProductSelector from "@/components/ProductSelector";
import ResultDisplay from "@/components/ResultDisplay";
import TemperatureChart from "@/components/TemperatureChart";
import HelpModal from "@/components/HelpModal";
import { uploadFile, collerDonnees, getProductConfig, saveAnalysis, getAnalysisById, type UniteTemps } from "@/lib/api";
import { uniteDuProcede, procedeAccorde } from "@/lib/pasteurisation";
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
  k_calc?: number;
  statut: string;
  message: string;
  evaluations_multimicro?: any[];
  risque: RisqueData;
  parametres: {
    t_ref: number;
    z: number;
    d_ref?: number;
    microorganisme: string;
    produit: string;
    lot_identifier?: string;
    unite_temps?: string | null;
    unite_temps_nom?: string | null;
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
  const [lotIdentifier, setLotIdentifier] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateTag = `${yyyy}-${mm}${dd}`;
    let seq = 1;
    try {
      const stored = localStorage.getItem("ifpc_recent_activities");
      if (stored) {
        const activities = JSON.parse(stored) as { type?: string; date?: string }[];
        const todayStr = `${yyyy}-${mm}-${dd}`;
        seq = activities.filter(
          (a) => a.type === "controle" && a.date?.startsWith(todayStr)
        ).length + 1;
      }
    } catch {}
    return `LOT-${dateTag}-${String(seq).padStart(3, "0")}`;
  });
  const [microorganisme, setMicroorganisme] = useState("");
  // Aucune valeur par défaut : le choix de l'unité est obligatoire.
  const [uniteTemps, setUniteTemps] = useState<UniteTemps | "">("");
  const [procede, setProcede] = useState("classique");
  const [tRef, setTRef] = useState("");
  const [zValue, setZValue] = useState("");
  const [ph, setPh] = useState("");
  const [titreAlcool, setTitreAlcool] = useState("");

  const [vpCibleConfig, setVpCibleConfig] = useState<Record<string, number>>({});
  const [showHelp, setShowHelp] = useState(false);

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

  const restoreFormState = useCallback((parsed: any) => {
    if (!parsed?.parametres) return;
    const p = parsed.parametres;
    if (p.product_type) setProductType(p.product_type);
    else if (p.produit) {
      const productKeyByLabel: Record<string, string> = {
        jus_pomme: "jus_pomme",
        "jus de pomme": "jus_pomme",
        cidre_doux: "cidre_doux",
        "cidre doux": "cidre_doux",
        cidre_demi_sec: "cidre_demi_sec",
        "cidre demi-sec": "cidre_demi_sec",
        cidre_brut: "cidre_brut",
        "cidre brut": "cidre_brut",
        cidre_extra_brut: "cidre_extra_brut",
        "cidre extra-brut": "cidre_extra_brut",
      };
      const key = productKeyByLabel[p.produit.toLowerCase()];
      if (key) setProductType(key);
    }
    if (p.microorganisme) setMicroorganisme(p.microorganisme);
    if (p.procede) setProcede(p.procede);
    if (p.unite_temps === "minute" || p.unite_temps === "seconde") {
      setUniteTemps(p.unite_temps);
    } else if (p.procede) {
      // Analyses antérieures au choix explicite : l'unité s'y déduisait du procédé.
      setUniteTemps(String(p.procede).toLowerCase().includes("flash") ? "seconde" : "minute");
    }
    if (p.lot_identifier) setLotIdentifier(p.lot_identifier);
    if (p.t_ref !== undefined && p.t_ref !== null) setTRef(String(p.t_ref));
    if (p.z !== undefined && p.z !== null) setZValue(String(p.z));
    if (p.ph !== undefined && p.ph !== null) setPh(String(p.ph));
    if (p.titre_alcool !== undefined && p.titre_alcool !== null) setTitreAlcool(String(p.titre_alcool));
  }, []);

  // Charger une analyse historique depuis localStorage ou ?history=ID
  useEffect(() => {
    // 1) Check localStorage restore (set by dashboard click)
    try {
      const restore = localStorage.getItem("ifpc_restore_result");
      if (restore) {
        localStorage.removeItem("ifpc_restore_result");
        const parsed = JSON.parse(restore);
        setResult(parsed);
        restoreFormState(parsed);
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
          restoreFormState(parsed);
        }
      } catch {
        // 3) Last resort: try to find in localStorage activities
        try {
          const stored = localStorage.getItem("ifpc_recent_activities");
          if (stored) {
            const activities = JSON.parse(stored);
            const match = activities.find((a: any) => a.id === historyId);
            if (!cancelled && match?.resultJson) {
              const parsed = JSON.parse(match.resultJson);
              setResult(parsed);
              restoreFormState(parsed);
            }
          }
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, restoreFormState]);

  // Choisir un procédé fixe l'unité correspondante…
  const choisirProcede = useCallback((valeur: string) => {
    setProcede(valeur);
    setUniteTemps(uniteDuProcede(valeur));
  }, []);

  // …et choisir une unité ramène le procédé vers une valeur compatible.
  const choisirUnite = useCallback((valeur: UniteTemps) => {
    setUniteTemps(valeur);
    setProcede((actuel) => procedeAccorde(actuel, valeur));
  }, []);

  // --- LOGIQUE (inchangée) ---
  const buildParams = useCallback((unite: UniteTemps) => {
    const params: Record<string, string | number | null> & { unite_temps: UniteTemps } = {
      product_type: productType,
      unite_temps: unite,
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
  }, [productType, microorganisme, procede, tRef, zValue, ph, titreAlcool, vpCibleConfig]);

  const handleReset = useCallback(() => {
    setProductType("jus_pomme");
    setMicroorganisme("");
    setUniteTemps("");
    setProcede("classique");
    setTRef("");
    setZValue("");
    setPh("");
    setTitreAlcool("");
    setExpertMode(false);
    setMode("manual");
    const defaultRows = [
      {temps: "0", temp: "20"}, {temps: "1", temp: "35"}, {temps: "2", temp: "50"},
      {temps: "3", temp: "60"}, {temps: "4", temp: "68"}, {temps: "5", temp: "72"},
      {temps: "6", temp: "72"}, {temps: "7", temp: "72"}, {temps: "8", temp: "65"},
      {temps: "9", temp: "50"}, {temps: "10", temp: "30"},
    ];
    setManualRows(defaultRows);
    syncManualData(defaultRows);
    setPasteText("");
    setFile(null);
    setResult(null);
    setError(null);
  }, [syncManualData]);

  const handleSubmit = async () => {
    if (!uniteTemps) {
      setError(t("controle.unitRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = buildParams(uniteTemps);
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
      const activityLabel = res.parametres?.produit || lotIdentifier || file?.name || (mode === "paste" ? t("controle.pastedDataLabel") : t("controle.manualDataLabel"));
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
      if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false);
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
    <div className="h-screen flex flex-col bg-brand-gray font-sans text-brand-text overflow-hidden relative">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
        <h1 className="font-bold text-gray-900 font-clash text-sm sm:text-base">{t("controle.title")}</h1>
        <div className="flex items-center gap-4">
          {user && (user.role === 'EXPERT' || user.role === 'ADMIN') && (
            <button
              onClick={() => setExpertMode(!expertMode)}
              className={`hidden lg:block text-xs font-semibold transition-colors ${
                expertMode ? "text-brand-accent" : "text-gray-400 hover:text-brand-accent"
              }`}
            >
              {t("bareme.expertMode")}
            </button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-black/[0.06] rounded-lg text-xs font-semibold text-gray-400 hover:text-brand-primary hover:border-brand-primary/20 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            {t("controle.help")}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">

      {/* --- SIDEBAR GAUCHE (DRAWER MOBILE) --- */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-30 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-white border-r border-black/[0.06] transition-all duration-300 ease-in-out flex flex-col overflow-hidden shadow-2xl lg:shadow-none
          ${isSidebarOpen ? "w-[300px] sm:w-[320px] translate-x-0" : "w-0 -translate-x-full lg:translate-x-0 lg:border-r-0"}
        `}
      >
        <div className={`${isSidebarOpen ? "opacity-100" : "opacity-0 lg:opacity-100"} transition-opacity duration-200 flex flex-col h-full overflow-hidden w-[300px] sm:w-[320px]`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04]">
            <h2 className="font-bold text-xs uppercase tracking-wider text-gray-500">Configuration</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleReset}
                title={t("common.reset")}
                className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-brand-primary transition-colors px-2 py-1 rounded-md hover:bg-gray-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t("common.reset")}</span>
              </button>
              {user && (user.role === 'EXPERT' || user.role === 'ADMIN') && (
                <button
                  onClick={() => setExpertMode(!expertMode)}
                  className={`lg:hidden px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    expertMode
                      ? "bg-brand-primary text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {t("bareme.expertMode")}
                </button>
              )}
              <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-gray-400 lg:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Product Parameters */}
              <div className="px-4 pt-4 pb-3 space-y-3">
              <ProductSelector
                productType={productType} onProductChange={setProductType}
                microorganisme={microorganisme} onMicroChange={setMicroorganisme}
                lotIdentifier={lotIdentifier} onLotIdentifierChange={setLotIdentifier}
                procede={procede} onProcedeChange={choisirProcede}
                expertMode={expertMode}
                tRef={tRef} onTRefChange={setTRef}
                zValue={zValue} onZChange={setZValue}
                ph={ph} onPhChange={setPh}
                titreAlcool={titreAlcool} onTitreAlcoolChange={setTitreAlcool}
              />

              {/* Unité de la colonne temps : choix obligatoire, lié au procédé */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("controle.unitLabel")}
                </p>
                <div className={`flex gap-1.5 rounded-lg ${uniteTemps ? "" : "ring-1 ring-amber-400/70"}`}>
                  {([["minute", t("controle.unitMinute")], ["seconde", t("controle.unitSecond")]] as const).map(
                    ([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => choisirUnite(value)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          uniteTemps === value
                            ? "bg-brand-primary text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
                {!uniteTemps && (
                  <p className="text-[10px] text-amber-600 font-medium leading-snug">
                    {t("controle.unitRequired")}
                  </p>
                )}
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
                      <p className="font-semibold text-brand-text truncate text-xs">{file?.name}</p>
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
                disabled={loading || !uniteTemps}
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

      </aside>

      {/* Toggle Button (Desktop) */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`hidden lg:flex absolute top-8 w-8 h-8 bg-white border border-black/[0.06] rounded-full items-center justify-center shadow-sm z-50 hover:bg-gray-50 transition-all duration-300 ease-in-out
          ${isSidebarOpen ? "left-[284px] sm:left-[304px]" : "left-4"}
        `}
      >
        {isSidebarOpen ? <ChevronLeft className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>

      {/* --- MAIN CONTENT AREA (Dashboard) --- */}
      <main className="flex-1 overflow-y-auto relative bg-brand-gray">
        {/* Mobile Toggle Button */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-30 w-12 h-12 bg-brand-primary text-white rounded-full shadow-lg flex items-center justify-center animate-in zoom-in duration-300"
          >
            <Settings2 className="w-6 h-6" />
          </button>
        )}
        {result ? (
          <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">

            {/* ── Header — product + lot ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b border-black/[0.06]">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <h1 className="text-sm font-bold text-brand-text uppercase tracking-wide truncate">{result.parametres.produit}</h1>
                  {result.parametres.lot_identifier && (
                    <span className="text-xs font-mono text-gray-400">#{result.parametres.lot_identifier}</span>
                  )}
                </div>
                <button
                  onClick={() => setIsRawDataDrawerOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 border border-black/[0.06] rounded-xl text-[11px] font-medium text-gray-500 hover:text-brand-text hover:border-black/[0.12] transition-colors bg-white"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  {t("controle.rawData")}
                </button>
              </div>
            </div>

            {/* ── Decision block: verdict + metrics ── */}
            <ResultDisplay result={result} />

            {/* ── Explanation: chart (separated) ── */}
            <div className="mt-6 sm:mt-8 bg-white rounded-lg border border-black/[0.06] overflow-hidden">
              <div className="px-5 py-3 border-b border-black/[0.04]">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t("controle.thermalKinetics")}</h3>
              </div>
              <div className="px-2 sm:px-5 py-4 h-[300px] sm:h-[360px]">
                <TemperatureChart
                  courbe={result.courbe}
                  evaluations={result.evaluations_multimicro}
                  tRef={result.parametres.t_ref}
                  vpCible={result.vp_cible}
                  statut={result.statut}
                  procede={result.parametres.procede}
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
                  {t("controle.rawDataSubtitle", { lot: result.parametres.lot_identifier || t("admin.notProvided") })}
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
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                          {t("controle.time")} ({(result.parametres.unite_temps ?? uniteTemps) === "seconde" ? "sec" : "min"})
                        </th>
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">{t("controle.temp")} (°C)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {result.courbe.temps.map((tVal, idx) => {
                        const enSecondes = (result.parametres.unite_temps ?? uniteTemps) === "seconde";
                        const timeDisplay = enSecondes ? tVal.toFixed(1) : tVal.toFixed(2);
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-2.5 font-mono text-gray-600">{timeDisplay}</td>
                            <td className="px-5 py-2.5 font-mono font-medium text-gray-900">{result.courbe.temperatures[idx].toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* MODAL D'AUTHENTIFICATION */}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}

      {/* HELP MODAL */}
      <HelpModal
        helpKey="calcul_vp"
        defaultContent={t("controle.defaultHelp")}
        title={t("controle.helpTitle")}
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />

    </div>
  );
}
