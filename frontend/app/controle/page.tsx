"use client";

import { useState, useCallback } from "react";
import { Upload, ClipboardPaste, Keyboard, Loader2, FileSpreadsheet, ChevronRight, ChevronLeft, LayoutDashboard, Settings2, Table as TableIcon, X, Activity, AlertTriangle, CheckCircle } from "lucide-react";
import ProductSelector from "@/components/ProductSelector";
// Assure-toi d'exporter KPICards depuis ResultDisplay ou de l'importer correctement
import { KPICards } from "@/components/ResultDisplay";
import TemperatureChart from "@/components/TemperatureChart";
import { uploadFile, collerDonnees } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useEffect } from "react";
import AuthModal from "@/components/AuthModal";
import AdminPanel from "@/components/AdminPanel";
import { LogOut, User as UserIcon, Shield } from "lucide-react";

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

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [manualData, setManualData] = useState("0\t20\n1\t35\n2\t50\n3\t60\n4\t68\n5\t72\n6\t72\n7\t72\n8\t65\n9\t50\n10\t30");

  // --- STATES UI (Nouveaux) ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRawDataDrawerOpen, setIsRawDataDrawerOpen] = useState(false); // État pour le Pop-up des données brutes
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // --- AUTH ---
  const { user, isLoading, checkAuth, logout } = useAuthStore();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
    return params;
  }, [productType, microorganisme, clarification, procede, tRef, zValue, ph, titreAlcool]);

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
      try {
        const activity = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: "controle",
          label: file?.name || (mode === "paste" ? "Données collées" : "Saisie manuelle"),
          statut: res.statut,
          vp: res.valeur_pasteurisatrice,
        };
        const stored = localStorage.getItem("ifpc_recent_activities");
        const existing = stored ? JSON.parse(stored) : [];
        const updated = [activity, ...existing].slice(0, 20); // max 20 entrées
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

      {/* --- SIDEBAR GAUCHE (Configuration & Inputs) --- */}
      <aside
        className={`${isSidebarOpen ? "w-[340px]" : "w-0"
          } transition-all duration-300 ease-in-out border-r border-gray-200 bg-white flex flex-col relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}
      >
        <div className={`${isSidebarOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-200 flex flex-col h-full overflow-hidden`}>
          <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-brand-primary" />
              Configuration
            </h2>
            
            {/* User Profile */}
            {!isLoading && (
              user ? (
                <div className="flex items-center gap-2">
                  <div 
                    onClick={() => user.role === 'ADMIN' && setShowAdminPanel(!showAdminPanel)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase cursor-pointer transition-transform hover:scale-105 ${
                      user.role === 'ADMIN' ? 'bg-red-100 text-red-700 shadow-sm' : 
                      user.role === 'EXPERT' ? 'bg-brand-accent/20 text-brand-accent' : 
                      'bg-brand-primary/10 text-brand-primary'
                    }`} 
                    title={`${user.firstName} (${user.role})`}
                  >
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                  </div>
                  <button onClick={() => { logout(); setShowAdminPanel(false); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors" title="Déconnexion">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:bg-brand-primary/5 px-2 py-1.5 rounded-md transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  Connexion
                </button>
              )
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Mode selection & Inputs */}
            <div className="p-6 border-b border-gray-50">
              <div className="flex p-1 bg-gray-100/80 rounded-lg mb-6">
                {(Object.keys(modeConfig) as InputMode[]).map((m) => {
                  const Icon = modeConfig[m].icon;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${mode === m ? "bg-white text-brand-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {modeConfig[m].label}
                    </button>
                  );
                })}
              </div>

              {/* Input Area */}
              {mode === "upload" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive ? "border-brand-primary bg-brand-primary/5" : "border-gray-200 hover:border-brand-primary/30 hover:bg-gray-50/50"
                    }`}
                >
                  {file ? (
                    <div className="text-sm">
                      <FileSpreadsheet className="w-10 h-10 text-brand-primary mx-auto mb-3" />
                      <p className="font-bold text-gray-900 truncate px-2">{file.name}</p>
                      <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:text-red-600 font-medium mt-3">Retirer le fichier</button>
                    </div>
                  ) : (
                    <div>
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Upload className="w-5 h-5 text-gray-400" />
                      </div>
                      <label className="text-sm text-brand-primary font-bold cursor-pointer hover:underline">
                        Parcourir les fichiers
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="text-xs text-gray-500 mt-2">ou glissez-déposez ici</p>
                    </div>
                  )}
                </div>
              )}

              {(mode === "paste" || mode === "manual") && (
                <textarea
                  value={mode === "paste" ? pasteText : manualData}
                  onChange={(e) => mode === "paste" ? setPasteText(e.target.value) : setManualData(e.target.value)}
                  placeholder={mode === "paste" ? "Temps\tTemp\n0\t20\n1\t45..." : ""}
                  className="w-full h-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-xs font-mono resize-none transition-all"
                />
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full btn-primary py-3 text-sm mt-6 flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 rounded-xl font-bold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                {loading ? "Calcul en cours..." : "Lancer l'analyse"}
              </button>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm font-medium flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* Product Parameters */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Paramètres Produit</h3>
                <button
                  onClick={() => {
                    if (!user || (user.role !== 'EXPERT' && user.role !== 'ADMIN')) {
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setExpertMode(!expertMode);
                  }}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-colors ${expertMode ? "bg-brand-accent text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  MODE EXPERT
                </button>
              </div>
              <ProductSelector
                // ... (tes props existantes)
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
        {showAdminPanel ? (
          <div className="p-8">
            <header className="mb-6">
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                <Shield className="w-8 h-8 text-red-500" />
                Espace Administration
              </h1>
              <p className="text-gray-500 mt-2">Gérez les rôles et les accès des utilisateurs de la plateforme IFPC.</p>
            </header>
            <AdminPanel />
          </div>
        ) : result ? (
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

    </div>
  );
}