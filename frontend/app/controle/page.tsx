"use client";

import { useState, useCallback } from "react";
import { Upload, ClipboardPaste, Keyboard, Loader2, FileSpreadsheet } from "lucide-react";
import ProductSelector from "@/components/ProductSelector";
import ResultDisplay from "@/components/ResultDisplay";
import TemperatureChart from "@/components/TemperatureChart";
import { uploadFile, collerDonnees } from "@/lib/api";

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
  };
  courbe: {
    temps: number[];
    temperatures: number[];
    taux_letaux: number[];
    vp_cumulee: number[];
  };
}

export default function ControlePage() {
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e.response?.data?.detail || e.message || "Erreur inconnue");
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

  const modeConfig: Record<InputMode, { icon: React.ElementType; label: string }> = {
    upload: { icon: Upload, label: "Fichier" },
    paste: { icon: ClipboardPaste, label: "Coller" },
    manual: { icon: Keyboard, label: "Saisie" },
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-clash">Contrôle de pasteurisation</h1>
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(modeConfig) as InputMode[]).map((m) => {
            const cfg = modeConfig[m];
            const Icon = cfg.icon;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === m
                    ? "bg-brand-primary text-white"
                    : "text-gray-500 hover:text-brand-primary hover:bg-gray-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content – fills remaining height */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: input + params */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
          {/* Data input */}
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Données</h2>

            {mode === "upload" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                  dragActive ? "border-brand-primary bg-brand-primary/5" : "border-gray-300"
                }`}
              >
                {file ? (
                  <div className="text-sm">
                    <p className="font-medium text-brand-primary truncate">{file.name}</p>
                    <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline mt-1">Supprimer</button>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <label className="text-xs text-brand-primary font-medium cursor-pointer hover:underline">
                      Parcourir
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </label>
                    <p className="text-[10px] text-gray-400 mt-1">.xlsx, .xls, .csv</p>
                  </div>
                )}
              </div>
            )}

            {mode === "paste" && (
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Collez vos données ici (export enregistreur, tableur…)"
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none text-xs font-mono resize-none"
              />
            )}

            {mode === "manual" && (
              <textarea
                value={manualData}
                onChange={(e) => setManualData(e.target.value)}
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none text-xs font-mono resize-none"
              />
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full btn-primary py-2 text-sm mt-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Calcul…" : "Calculer VP"}
            </button>

            {error && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
                {error}
              </div>
            )}
          </div>

          {/* Params */}
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Paramètres</h2>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={expertMode}
                  onChange={(e) => setExpertMode(e.target.checked)}
                  className="w-3.5 h-3.5 text-brand-accent rounded focus:ring-brand-accent"
                />
                <span className="text-brand-accent font-medium">Expert</span>
              </label>
            </div>
            <ProductSelector
              productType={productType}
              onProductChange={setProductType}
              microorganisme={microorganisme}
              onMicroChange={setMicroorganisme}
              clarification={clarification}
              onClarificationChange={setClarification}
              procede={procede}
              onProcedeChange={setProcede}
              expertMode={expertMode}
              tRef={tRef}
              onTRefChange={setTRef}
              zValue={zValue}
              onZChange={setZValue}
              ph={ph}
              onPhChange={setPh}
              titreAlcool={titreAlcool}
              onTitreAlcoolChange={setTitreAlcool}
            />
          </div>
        </div>

        {/* Right panel: results + charts fill remaining space */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {result ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">
              {/* Diagnostic */}
              <div className="space-y-4">
                <ResultDisplay result={result} />
              </div>
              {/* Charts */}
              {result.courbe && (
                <div className="space-y-4">
                  <TemperatureChart
                    courbe={result.courbe}
                    tRef={result.parametres.t_ref}
                    vpCible={result.vp_cible}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300">
              <div className="text-center">
                <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="text-sm">Importez des données et lancez le calcul</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
