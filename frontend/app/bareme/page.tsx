"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Info, Timer, Thermometer, FlaskConical, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// ── Données de référence ──────────────────────────────────────────────────

const MICROORGANISMES: Record<string, { nom: string; t_ref: number; z: number; d_ref: number; vp_cible: number }> = {
  alicyclo_std:       { nom: "Alicyclobacillus acidoterrestris", t_ref: 95, z: 10.9, d_ref: 20.8, vp_cible: 104   },
  alicyclo_res:       { nom: "Alicyclobacillus acidoterrestris", t_ref: 95, z: 16.4, d_ref: 27.8, vp_cible: 139   },
  ecoli:              { nom: "Escherichia coli",                  t_ref: 62, z: 6.0,  d_ref: 1.5,  vp_cible: 7.5  },
  salmonella:         { nom: "Salmonella",                        t_ref: 62, z: 6.0,  d_ref: 0.5,  vp_cible: 2.5  },
  byssochlamys_fulva: { nom: "Byssochlamys fulva",                t_ref: 95, z: 7.1,  d_ref: 1.8,  vp_cible: 9    },
  saccharo_jus:       { nom: "Saccharomyces cerevisiae",          t_ref: 60, z: 4.0,  d_ref: 22.5, vp_cible: 112.5 },
  saccharo_cidre_low: { nom: "Saccharomyces cerevisiae",          t_ref: 60, z: 4.0,  d_ref: 0.4,  vp_cible: 2    },
  saccharo_cidre:     { nom: "Saccharomyces cerevisiae",          t_ref: 60, z: 4.0,  d_ref: 1.1,  vp_cible: 5.5  },
};

const PRODUITS: Record<string, { nom: string; micro: string; vp_cible: number }> = {
  jus_pomme:        { nom: "Jus de pomme",      micro: "alicyclo_res",   vp_cible: 139 },
  cidre_doux:       { nom: "Cidre doux",         micro: "saccharo_cidre", vp_cible: 5.5 },
  cidre_demi_sec:   { nom: "Cidre demi-sec",     micro: "saccharo_cidre", vp_cible: 5.5 },
  cidre_brut:       { nom: "Cidre brut",         micro: "saccharo_cidre", vp_cible: 5.5 },
  cidre_extra_brut: { nom: "Cidre extra-brut",   micro: "saccharo_cidre", vp_cible: 5.5 },
};

const PRODUCT_LABELS: Record<string, { fr: string; en: string }> = {
  jus_pomme: { fr: "Jus de pomme", en: "Apple juice" },
  cidre_doux: { fr: "Cidre doux", en: "Sweet cider" },
  cidre_demi_sec: { fr: "Cidre demi-sec", en: "Semi-dry cider" },
  cidre_brut: { fr: "Cidre brut", en: "Dry cider" },
  cidre_extra_brut: { fr: "Cidre extra-brut", en: "Extra-dry cider" },
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function BaremePage() {
  const { t, locale } = useI18n();
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
    if (phN > 3.8) a.push({ type: "danger", msg: t("bareme.alertHighPH", { ph: phN }) });
    if (pasteType === "flash" && computed.holdMin > 1) a.push({ type: "warning", msg: t("bareme.alertFlashTime") });
    if (alcN > 4) a.push({ type: "info", msg: t("bareme.alertAlcohol", { n: alcN }) });
    return a;
  }, [computed, ph, alcool, pasteType, t]);

  const produit = PRODUITS[productType];
  const productLabel = (key: string) => PRODUCT_LABELS[key]?.[locale] || PRODUITS[key]?.nom || key;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
        <h1 className="font-bold text-gray-900 font-clash">{t("bareme.title")}</h1>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={expertMode} onChange={e => setExpertMode(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-brand-accent" />
          <span className="font-semibold text-brand-accent">{t("bareme.expertMode")}</span>
        </label>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left — Demande */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4 space-y-4">

          {/* Infos déclaratives — Produit */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t("bareme.product")}</p>
            <select value={productType} onChange={e => setProductType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary">
              {Object.entries(PRODUITS).map(([k]) => <option key={k} value={k}>{productLabel(k)}</option>)}
            </select>
          </div>

           {/* T° consigne */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t("bareme.tempConsigne")}</p>
            <input type="number" step="1" min="50" max="100" value={tConsigne}
              onChange={e => setTConsigne(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-brand-primary outline-none focus:border-brand-primary" />
          </div>

          {/* Infos déclaratives — Clarté */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t("bareme.clarity")}</p>
            <div className="flex gap-1.5">
              {[[t("bareme.turbid"), true], [t("bareme.clear"), false]].map(([label, val]) => (
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
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t("bareme.physicoChem")}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">{t("bareme.ph")}</p>
                <input type="number" step="0.1" placeholder="3.5" value={ph} onChange={e => setPh(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-primary" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">{t("bareme.alcohol")}</p>
                <input type="number" step="0.1" placeholder="4.5" value={alcool} onChange={e => setAlcool(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-primary" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

         

          {/* Pasteurisateur */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t("bareme.pastType")}</p>
            <div className="flex gap-1.5">
              {[[t("bareme.flash"), "flash"], [t("bareme.tunnel"), "tunnel"]].map(([label, val]) => (
                <button key={val as string} onClick={() => setPasteType(val as "flash" | "tunnel")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pasteType === val ? "bg-brand-accent text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {label as string}
                </button>
              ))}
            </div>
          </div>

          {/* Expert — microorganisme parameterization */}
          {expertMode && (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">{t("bareme.expertParams")}</p>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">{t("bareme.microTarget")}</p>
                <select value={microKey} onChange={e => setMicroKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand-accent">
                  <option value="">{t("bareme.microDefault", { name: `${MICROORGANISMES[produit?.micro]?.nom} — D=${MICROORGANISMES[produit?.micro]?.d_ref} min` })}</option>
                  {Object.entries(MICROORGANISMES).map(([k, v]) => (
                    <option key={k} value={k}>{v.nom} — D={v.d_ref} min @ {v.t_ref}°C</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">{t("bareme.tref")}</p>
                  <input type="number" step="0.1" placeholder="60" value={customTref}
                    onChange={e => setCustomTref(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-brand-accent" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">{t("bareme.z")}</p>
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{t("bareme.result")}</p>
                  <div className="flex items-end gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Thermometer className="w-5 h-5 text-brand-accent" />
                        <span className="text-xs font-semibold text-gray-400">{t("bareme.temperature")}</span>
                      </div>
                      <p className="text-4xl font-extrabold text-gray-900">{computed.tC}<span className="text-lg text-gray-400 ml-0.5">°C</span></p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Timer className="w-5 h-5 text-brand-primary" />
                        <span className="text-xs font-semibold text-gray-400">{t("bareme.holdTime")}</span>
                      </div>
                      <p className="text-4xl font-extrabold text-brand-primary">
                        {computed.holdSec < 60
                          ? <>{computed.holdSec.toFixed(1)}<span className="text-lg text-gray-400 ml-1">{t("bareme.sec")}</span></>
                          : <>{computed.holdMin.toFixed(2)}<span className="text-lg text-gray-400 ml-1">{t("bareme.min")}</span></>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contexte compact */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
                  <span>{t("bareme.vpCible")} <strong className="text-gray-600">{computed.vp} {t("bareme.up")}</strong></span>
                  <span>{t("bareme.lethalRate")} <strong className="text-gray-600">{computed.L}</strong></span>
                  <span>{t("bareme.process")} <strong className="text-gray-600">{pasteType === "flash" ? t("bareme.flash") : t("bareme.tunnel")}</strong></span>
                  <span>{trouble ? t("bareme.turbid") : t("bareme.clear")}</span>
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("bareme.calcParams")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">{t("bareme.micro")}</p>
                    <p className="font-semibold text-gray-700 text-xs italic">{computed.micro.nom}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">{t("bareme.product")}</p>
                    <p className="font-semibold text-gray-700 text-xs">{productLabel(productType)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">{t("bareme.tref")}</p>
                    <p className="font-semibold text-gray-700 text-xs">{computed.tRef}°C</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">{t("bareme.z")}</p>
                    <p className="font-semibold text-gray-700 text-xs">{computed.z}°C</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">D (Tref)</p>
                    <p className="font-semibold text-gray-700 text-xs">{computed.micro.d_ref} min</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{t("bareme.emptyState")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
