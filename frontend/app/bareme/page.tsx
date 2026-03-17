"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Info, Flame } from "lucide-react";

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

function computeBareme(tRef: number, z: number, vpCible: number) {
  return [60, 63, 65, 68, 70, 72, 75, 78, 80, 85, 90, 95].map((t) => {
    const L = Math.pow(10, (t - tRef) / z);
    return { t, min: +(vpCible / L).toFixed(3), sec: +((vpCible / L) * 60).toFixed(1), L: +L.toFixed(4) };
  });
}

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
    const baremes = computeBareme(tRef, z, vp);
    return { micro, tRef, z, vp: +vp.toFixed(2), tC, holdMin, holdSec: holdMin * 60, baremes };
  }, [productType, trouble, pasteType, tConsigne, microKey, customTref, customZ]);

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
        {/* Left — inputs */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4 space-y-4">

          {/* Produit */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Produit</p>
            <select value={productType} onChange={e => setProductType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary">
              {Object.entries(PRODUITS).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}
            </select>
          </div>

          {/* Clarté */}
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

          {/* Physico-chimie */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Physico-chimie</p>
            <div className="grid grid-cols-2 gap-2">
              {[["pH", ph, setPh, "3.5", "0.1"], ["Alcool %", alcool, setAlcool, "4.5", "0.1"]].map(
                ([label, val, set, ph_holder, step]) => (
                  <div key={label as string}>
                    <p className="text-[10px] text-gray-400 mb-1">{label as string}</p>
                    <input type="number" step={step as string} placeholder={ph_holder as string}
                      value={val as string}
                      onChange={e => (set as any)(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-primary" />
                  </div>
                )
              )}
            </div>
          </div>

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

          {/* Expert */}
          {expertMode && (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Expert</p>
              <select value={microKey} onChange={e => setMicroKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-accent">
                <option value="">— Micro-organisme par défaut —</option>
                {Object.entries(MICROORGANISMES).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                {[["Tref (°C)", customTref, setCustomTref, "60"], ["Z (°C)", customZ, setCustomZ, "7"]].map(
                  ([label, val, set, ph]) => (
                    <div key={label as string}>
                      <p className="text-[10px] text-gray-400 mb-1">{label as string}</p>
                      <input type="number" step="0.1" placeholder={ph as string} value={val as string}
                        onChange={e => (set as any)(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-accent" />
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right — résultats */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {computed ? (
            <>
              {/* Recommandation */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Recommandation</p>
                <p className="text-2xl font-extrabold text-brand-primary">
                  {computed.tC}°C ·{" "}
                  {computed.holdSec < 60
                    ? `${computed.holdSec.toFixed(1)} s`
                    : `${computed.holdMin.toFixed(2)} min`}
                </p>
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                  <span>VP cible <strong className="text-gray-700">{computed.vp} UP</strong></span>
                  <span>Tref <strong className="text-gray-700">{computed.tRef}°C</strong></span>
                  <span>Z <strong className="text-gray-700">{computed.z}°C</strong></span>
                  <span className="truncate">Micro <strong className="text-gray-700 italic">{computed.micro.nom}</strong></span>
                </div>
              </div>

              {/* Alertes */}
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

              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">Table des barèmes</p>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> L = 10<sup>(T−Tref)/Z</sup>
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      {["T °C", "Durée (min)", "Durée (sec)", "Taux létal"].map(h => (
                        <th key={h} className="px-5 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {computed.baremes.map(b => {
                      const isActive = b.t === computed.tC;
                      const isRef = b.t === computed.tRef;
                      return (
                        <tr key={b.t} className={isActive ? "bg-brand-primary/8 font-semibold" : isRef ? "bg-yellow-50/60" : "hover:bg-gray-50/40"}>
                          <td className="px-5 py-2">
                            {b.t}°C
                            {isActive && <span className="ml-2 text-[10px] bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-full">consigne</span>}
                            {isRef && <span className="ml-2 text-[10px] bg-yellow-200 text-yellow-700 px-1.5 py-0.5 rounded-full">Tref</span>}
                          </td>
                          <td className="px-5 py-2 font-mono">{b.min < 0.01 ? "< 0.01" : b.min}</td>
                          <td className="px-5 py-2 font-mono">{b.sec < 0.1 ? "< 0.1" : b.sec}</td>
                          <td className="px-5 py-2 font-mono text-gray-400">{b.L}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300 text-sm">
              Renseignez les paramètres pour obtenir un barème.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
