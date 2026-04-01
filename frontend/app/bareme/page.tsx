"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Info, Timer, Thermometer, FlaskConical, ShieldCheck } from "lucide-react";

// ── Données de référence ──────────────────────────────────────────────────

const MICROORGANISMES: Record<string, { nom: string; t_ref: number; z: number; vp_cible: number }> = {
  alicyclobacillus_acidoterrestris: { nom: "Alicyclobacillus acidoterrestris", t_ref: 60, z: 7, vp_cible: 15 },
  levures:           { nom: "Levures d'altération",  t_ref: 60, z: 7, vp_cible: 5  },
  moisissures:       { nom: "Moisissures",           t_ref: 60, z: 7, vp_cible: 10 },
  byssochlamys_fulva:{ nom: "Byssochlamys fulva",    t_ref: 60, z: 7, vp_cible: 20 },
  lactobacilles:     { nom: "Lactobacilles",         t_ref: 60, z: 7, vp_cible: 5  },
};

const PRODUITS: Record<string, { nom: string; micro: string; vp_cible: number }> = {
  jus_pomme:        { nom: "Jus de pomme",      micro: "alicyclobacillus_acidoterrestris", vp_cible: 15 },
  cidre_doux:       { nom: "Cidre doux",         micro: "levures",                          vp_cible: 10 },
  cidre_demi_sec:   { nom: "Cidre demi-sec",     micro: "levures",                          vp_cible: 8  },
  cidre_brut:       { nom: "Cidre brut",         micro: "levures",                          vp_cible: 5  },
  cidre_extra_brut: { nom: "Cidre extra-brut",   micro: "levures",                          vp_cible: 5  },
  autre:            { nom: "Autre",              micro: "alicyclobacillus_acidoterrestris", vp_cible: 15 },
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function BaremePage() {
  const [productType, setProductType] = useState("jus_pomme");
  const [trouble, setTrouble] = useState(true);
  const [pasteType, setPasteType] = useState<"flash" | "tunnel">("flash");
  const [tConsigne, setTConsigne] = useState("75");
  const [ph, setPh] = useState("");
  const [alcool, setAlcool] = useState("");
  const [expertMode, setExpertMode] = useState(false);
  const [microKey, setMicroKey] = useState("");
  const [customTref, setCustomTref] = useState("");
  const [customZ, setCustomZ] = useState("");

  const computed = useMemo(() => {
    const produit = PRODUITS[productType];
    if (!produit) return null;
    const micro = MICROORGANISMES[microKey || produit.micro];
    if (!micro) return null;
    const tRef = customTref ? parseFloat(customTref) : micro.t_ref;
    const z    = customZ    ? parseFloat(customZ)    : micro.z;
    if (!tRef || !z) return null;
    let vp = micro.vp_cible;
    if (trouble) vp *= 1.2;
    const tC = parseFloat(tConsigne);
    if (!tC) return null;
    const L = Math.pow(10, (tC - tRef) / z);
    const holdMin = vp / L;
    return { micro, tRef, z, vp: +vp.toFixed(2), tC, L: +L.toFixed(4), holdMin, holdSec: holdMin * 60 };
  }, [productType, trouble, tConsigne, microKey, customTref, customZ]);

  // Alertes
  const alertes = useMemo(() => {
    if (!computed) return [];
    const a: { type: "danger" | "warning" | "info"; msg: string }[] = [];
    const phN = parseFloat(ph);
    const alcN = parseFloat(alcool);
    if (phN > 3.8) a.push({ type: "danger", msg: `pH élevé (${phN}) — risque fort de refermentation.` });
    if (pasteType === "flash" && computed.holdMin > 1) a.push({ type: "warning", msg: `Temps de maintien > 1 min pour un flash : augmentez la T° consigne.` });
    if (alcN > 4) a.push({ type: "info", msg: `Alcool ${alcN}% vol. — protection partielle, la VP cible peut être abaissée en mode expert.` });
    return a;
  }, [computed, ph, alcool, pasteType]);

  const produit = PRODUITS[productType];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
        <h1 className="font-bold text-gray-900 font-clash">Aide au barème</h1>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={expertMode} onChange={e => setExpertMode(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-brand-accent" />
          <span className="font-semibold text-brand-accent">Mode expert</span>
        </label>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left — Demande */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4 space-y-4">

          {/* Infos déclaratives — Produit */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Produit</p>
            <select value={productType} onChange={e => setProductType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary">
              {Object.entries(PRODUITS).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}
            </select>
          </div>

          {/* Infos déclaratives — Clarté */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Clarté</p>
            <div className="flex gap-1.5">
              {[["Trouble", true], ["Limpide", false]].map(([label, val]) => (
                <button key={String(val)} onClick={() => setTrouble(val as boolean)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    trouble === val ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {label as string}
                </button>
              ))}
            </div>
          </div>

          {/* Infos déclaratives — Physico-chimie */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Physico-chimie</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">pH</p>
                <input type="number" step="0.1" placeholder="3.5" value={ph} onChange={e => setPh(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-primary" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Alcool %</p>
                <input type="number" step="0.1" placeholder="4.5" value={alcool} onChange={e => setAlcool(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-primary" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Pasteurisateur */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Pasteurisateur</p>
            <div className="flex gap-1.5 mb-2">
              {[["Flash", "flash"], ["Tunnel", "tunnel"]].map(([label, val]) => (
                <button key={val as string} onClick={() => setPasteType(val as "flash" | "tunnel")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pasteType === val ? "bg-brand-accent text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {label as string}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mb-1">T° consigne (°C)</p>
            <input type="number" step="1" min="50" max="100" value={tConsigne}
              onChange={e => setTConsigne(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-brand-primary outline-none focus:border-brand-primary" />
          </div>

          {/* Expert — microorganisme parameterization */}
          {expertMode && (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">Paramétrage expert</p>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Micro-organisme cible</p>
                <select value={microKey} onChange={e => setMicroKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-accent">
                  <option value="">— Par défaut ({MICROORGANISMES[produit?.micro]?.nom}) —</option>
                  {Object.entries(MICROORGANISMES).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Tref (°C)</p>
                  <input type="number" step="0.1" placeholder="60" value={customTref}
                    onChange={e => setCustomTref(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-accent" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Z (°C)</p>
                  <input type="number" step="0.1" placeholder="7" value={customZ}
                    onChange={e => setCustomZ(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-accent" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Résultat */}
        <div className="flex-1 overflow-y-auto p-5">
          {computed ? (
            <div className="max-w-xl mx-auto space-y-4">
              {/* RÉSULTAT PRINCIPAL — la réponse directe */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Résultat</p>
                  <div className="flex items-end gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Thermometer className="w-5 h-5 text-brand-accent" />
                        <span className="text-xs font-semibold text-gray-400">Température</span>
                      </div>
                      <p className="text-4xl font-extrabold text-gray-900">{computed.tC}<span className="text-lg text-gray-400 ml-0.5">°C</span></p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Timer className="w-5 h-5 text-brand-primary" />
                        <span className="text-xs font-semibold text-gray-400">Durée de maintien</span>
                      </div>
                      <p className="text-4xl font-extrabold text-brand-primary">
                        {computed.holdSec < 60
                          ? <>{computed.holdSec.toFixed(1)}<span className="text-lg text-gray-400 ml-1">sec</span></>
                          : <>{computed.holdMin.toFixed(2)}<span className="text-lg text-gray-400 ml-1">min</span></>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contexte compact */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
                  <span>VP cible <strong className="text-gray-600">{computed.vp} UP</strong></span>
                  <span>Taux létal <strong className="text-gray-600">{computed.L}</strong></span>
                  <span>Procédé <strong className="text-gray-600">{pasteType === "flash" ? "Flash" : "Tunnel"}</strong></span>
                  <span>{trouble ? "Trouble" : "Limpide"}</span>
                </div>
              </div>

              {/* Alertes */}
              {alertes.length > 0 && (
                <div className="space-y-2">
                  {alertes.map((a, i) => {
                    const Icon = a.type === "info" ? Info : AlertTriangle;
                    const cls = a.type === "danger"
                      ? "bg-red-50 border-red-100 text-red-700"
                      : a.type === "warning"
                      ? "bg-amber-50 border-amber-100 text-amber-700"
                      : "bg-blue-50 border-blue-100 text-blue-700";
                    return (
                      <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${cls}`}>
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        {a.msg}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recommandation — en bas, plus discret */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical className="w-4 h-4 text-gray-400" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paramètres de calcul</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">Micro-organisme</p>
                    <p className="font-semibold text-gray-700 text-xs italic">{computed.micro.nom}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">Produit</p>
                    <p className="font-semibold text-gray-700 text-xs">{produit?.nom}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">Tref</p>
                    <p className="font-semibold text-gray-700 text-xs">{computed.tRef}°C</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">Z</p>
                    <p className="font-semibold text-gray-700 text-xs">{computed.z}°C</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Renseignez les paramètres pour obtenir le barème.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
