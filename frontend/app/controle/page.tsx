"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { Upload, ClipboardPaste, Keyboard, Loader2, FileSpreadsheet, ChevronRight, ChevronLeft, LayoutDashboard, Settings2, Table as TableIcon, X, Activity, AlertTriangle, CheckCircle, Plus, Trash2, HelpCircle, LogOut, User as UserIcon, Shield, Pencil, Save } from "lucide-react";
import ProductSelector from "@/components/ProductSelector";
import { KPICards } from "@/components/ResultDisplay";
import TemperatureChart from "@/components/TemperatureChart";
import { uploadFile, collerDonnees, getProductConfig, saveAnalysis, getAnalysisById, getHelpText, updateHelpText } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useSearchParams } from "next/navigation";
import AuthModal from "@/components/AuthModal";

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

const DEFAULT_HELP_TEXT = `Qu'est-ce que la VP ?
La Valeur Pasteurisatrice (VP) quantifie l'effet létal d'un traitement thermique sur les microorganismes cibles. Elle s'exprime en UP (Unités de Pasteurisation) et est calculée par la méthode de Bigelow.

Comment utiliser cet outil ?
1. Importez vos données : fichier Excel/CSV, collé ou saisie manuelle
2. Choisissez le produit et les paramètres de pasteurisation
3. Lancez l'analyse pour obtenir la VP et le diagnostic

Interprétation des résultats
• Conforme : la VP atteint ou dépasse la cible
• Vigilance : la VP est proche de la cible
• Insuffisant : la VP est en dessous de la cible

Mode Expert : Réservé aux utilisateurs EXPERT et ADMIN. Permet de personnaliser Tref, Z, microorganisme cible, pH et titre alcoométrique.`;

function ControlePageInner() {
  const searchParams = useSearchParams();

  // --- STATES METIER (inchangés) ---
  const [mode, setMode] = useState<InputMode>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PasteurisationResult | null>(null);
  const [expertMode, setExpertMode] = useState(false);

  const [productType, setProductType] = useState("jus_pomme");
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
    getHelpText("calcul_vp")
      .then((res) => {
        if (res.content) setHelpContent(res.content);
      })
      .catch(() => {});
  }, [showHelp]);

  const handleHelpSave = async () => {
    setHelpSaving(true);
    try {
      await updateHelpText("calcul_vp", helpDraft);
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
      let res;
      if (mode === "upload") {
        if (!file) { setError("Veuillez sélectionner un fichier"); setLoading(false); return; }
        res = await uploadFile(file, params);
      } else if (mode === "paste") {
        if (!pasteText.trim()) { setError("Veuillez coller des données"); setLoading(false); return; }
        res = await collerDonnees({ raw_text: pasteText, product_type: productType, ...params });
      } else {
        if (!manualData.trim()) { setError("Veuillez saisir des données"); setLoading(false); return; }
        res = await collerDonnees({ raw_text: manualData, product_type: productType, ...params });
      }
      setResult(res);
      // --- Sauvegarder l'activité récente ---
      const activityLabel = res.parametres?.produit || file?.name || (mode === "paste" ? "Données collées" : "Saisie manuelle");
      try {
        // Sauvegarde persistante en base via Spring Boot
        await saveAnalysis({
          type: "controle",
          label: activityLabel,
          statut: res.statut,
          vp: res.vp,
          vpCible: res.vp_cible,
          parametres: JSON.stringify(res.parametres || {}),
          courbe: JSON.stringify(res.courbe || {}),
          resultJson: JSON.stringify(res),
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
          produit: res.parametres?.produit,
          procede: res.parametres?.procede,
          statut: res.statut,
          vp: res.vp,
          vpCible: res.vp_cible,
          resultJson: JSON.stringify(res),
        };
        const stored = localStorage.getItem("ifpc_recent_activities");
        const existing = stored ? JSON.parse(stored) : [];
        const updated = [activity, ...existing].slice(0, 20);
        localStorage.setItem("ifpc_recent_activities", JSON.stringify(updated));
      } catch {}

      // Optionnel : fermer la sidebar d'input une fois le résultat obtenu pour laisser toute la place
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Erreur inconnue");
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
    upload: { icon: Upload, label: "Fichier" },
    paste: { icon: ClipboardPaste, label: "Coller" },
    manual: { icon: Keyboard, label: "Saisie" },
  };

  return (
    <div className="h-screen flex bg-gray-50/50 font-sans text-gray-900 overflow-hidden">

      {/* --- SIDEBAR GAUCHE --- */}
      <aside
        className={`${isSidebarOpen ? "w-[320px]" : "w-0"
          } transition-all duration-300 ease-in-out border-r border-gray-100 bg-white flex flex-col relative z-20`}
      >
        <div className={`${isSidebarOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-200 flex flex-col h-full overflow-hidden`}>

          <div className="flex-1 overflow-y-auto">
            {/* Product Parameters */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Produit</h3>
                {user && (user.role === 'EXPERT' || user.role === 'ADMIN') && (
                  <button
                    onClick={() => setExpertMode(!expertMode)}
                    className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${expertMode ? "bg-brand-accent text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    EXPERT
                  </button>
                )}
              </div>
              <ProductSelector
                productType={productType} onProductChange={setProductType}
                microorganisme={microorganisme} onMicroChange={setMicroorganisme}
                clarification={clarification} onClarificationChange={setClarification}
                procede={procede} onProcedeChange={setProcede}
                expertMode={expertMode}
                tRef={tRef} onTRefChange={setTRef}
                zValue={zValue} onZChange={setZValue}
                ph={ph} onPhChange={setPh}
                titreAlcool={titreAlcool} onTitreAlcoolChange={setTitreAlcool}
              />
            </div>

            <div className="mx-4 border-t border-gray-100" />

            {/* Data input */}
            <div className="px-4 py-3">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Données</h3>
              <div className="flex p-0.5 bg-gray-100 rounded-lg mb-3">
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
                  className={`border-2 border-dashed rounded-lg p-5 text-center transition-all ${dragActive ? "border-brand-primary bg-brand-primary/5" : "border-gray-200 hover:border-brand-primary/30"
                    }`}
                >
                  {file ? (
                    <div className="text-sm">
                      <FileSpreadsheet className="w-8 h-8 text-brand-primary mx-auto mb-2" />
                      <p className="font-semibold text-gray-900 truncate text-xs">{file.name}</p>
                      <button onClick={() => setFile(null)} className="text-[10px] text-red-500 hover:text-red-600 font-medium mt-2">Retirer</button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                      <label className="text-xs text-brand-primary font-bold cursor-pointer hover:underline">
                        Parcourir
                        <input type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="text-[10px] text-gray-400 mt-1">ou glissez-déposez</p>
                    </div>
                  )}
                </div>
              )}

              {mode === "paste" && (
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Temps\tTempérature\n0\t20\n1\t45\n2\t68..."}
                  className="w-full h-36 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-[11px] font-mono resize-none"
                />
              )}

              {mode === "manual" && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-44 overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-1.5 text-left font-bold text-gray-500 text-[9px] uppercase w-8">#</th>
                          <th className="px-2 py-1.5 text-left font-bold text-gray-500 text-[9px] uppercase">Temps</th>
                          <th className="px-2 py-1.5 text-left font-bold text-gray-500 text-[9px] uppercase">T°C</th>
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
                              <button onClick={() => removeRow(idx)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500" title="Supprimer">
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
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold text-brand-primary hover:bg-brand-primary/5 border-t border-gray-100"
                  >
                    <Plus className="w-3 h-3" /> Ligne
                  </button>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full mt-3 py-2.5 text-sm flex items-center justify-center gap-2 rounded-lg font-bold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {loading ? "Calcul..." : "Lancer l'analyse"}
              </button>

              {error && (
                <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3 text-red-600 text-xs font-medium flex items-start gap-2">
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
          className="absolute -right-4 top-8 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm z-30 hover:bg-gray-50 transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>
      </aside>

      {/* --- MAIN CONTENT AREA (Dashboard) --- */}
      <main className="flex-1 overflow-y-auto relative bg-[#F8FAFC]">
        {/* Help button */}
        <button
          onClick={() => setShowHelp(true)}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:text-brand-primary hover:border-brand-primary/30 transition-all shadow-sm"
        >
          <HelpCircle className="w-4 h-4" />
          Aide
        </button>

        {result ? (
          <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">

            {/* Nouveau Header Pro */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-200/60 mb-2">
              <div>
                <p className="text-sm font-bold text-brand-primary mb-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Analyse Terminée
                </p>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Rapport de Pasteurisation</h1>
              </div>
              <button
                onClick={() => setIsRawDataDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <TableIcon className="w-4 h-4 text-gray-500" />
                Voir les données brutes
              </button>
            </header>

            {/* Top: KPI Cards (Le composant qu'on a épuré précédemment) */}
            <KPICards result={result} />

            {/* Center: Chart (Prend plus de place, fond blanc pur) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary/40 to-brand-accent/40"></div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-gray-400" />
                  Cinétique Thermique & Évolution des UP
                </h3>
              </div>
              <div className="p-6 h-[450px]">
                {/* J'ai forcé une hauteur h-[450px] pour que la courbe respire */}
                <TemperatureChart
                  courbe={result.courbe}
                  tRef={result.parametres.t_ref}
                  vpCible={result.vp_cible}
                />
              </div>
            </div>


          </div>
        ) : (
          /* Empty State amélioré */
          <div className="h-full flex items-center justify-center p-12">
            <div className="max-w-md text-center">
              <div className="w-24 h-24 bg-white rounded-full border-8 border-gray-50 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Activity className="w-10 h-10 text-brand-primary/50" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Prêt à analyser votre lot</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Utilisez le panneau de configuration à gauche pour définir vos paramètres et importer vos relevés de température.
              </p>
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex items-center gap-2 text-white bg-brand-primary px-6 py-3 rounded-full font-bold hover:bg-brand-primary/90 transition-all shadow-md shadow-brand-primary/20"
                >
                  Ouvrir la configuration <ChevronRight className="w-4 h-4" />
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
                  Données Brutes du Lot
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Extraction des {result.courbe.temps.length} points de mesure
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
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">Temps (min)</th>
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">Temp (°C)</th>
                        <th className="px-5 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">VP Cumulée</th>
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
                Aide &mdash; Calcul de la VP
              </h3>
              <div className="flex items-center gap-1">
                {user?.role === "ADMIN" && !helpEditing && (
                  <button
                    onClick={() => { setHelpEditing(true); setHelpDraft(helpContent || DEFAULT_HELP_TEXT); }}
                    title="Modifier"
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
                <p className="text-xs text-gray-400">Modifiez le texte d&apos;aide ci-dessous. Le contenu sera visible par tous les utilisateurs.</p>
                <textarea
                  value={helpDraft}
                  onChange={(e) => setHelpDraft(e.target.value)}
                  rows={14}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleHelpSave}
                    disabled={helpSaving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                  >
                    {helpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setHelpEditing(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {helpContent || DEFAULT_HELP_TEXT}
              </div>
            )}

            {!helpEditing && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-full py-2.5 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
                >
                  Compris
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}