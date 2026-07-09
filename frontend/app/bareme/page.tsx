"use client";

import { Suspense, useState, useMemo } from "react";
import { AlertTriangle, Info, ShieldCheck, HelpCircle, ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import HelpModal from "@/components/HelpModal";

// ── Données de référence ──────────────────────────────────────────────────

const MICROORGANISMES: Record<string, { nom: string; t_ref: number; z: number; d_ref: number; vp_cible: number }> = {
  alicyclo_std:       { nom: "Alicyclobacillus acidoterrestris", t_ref: 95, z: 10.9, d_ref: 20.8, vp_cible: 104   },
  alicyclo_res:       { nom: "Alicyclobacillus acidoterrestris", t_ref: 95, z: 16.4, d_ref: 27.8, vp_cible: 139   },
  ecoli:              { nom: "Escherichia coli",                  t_ref: 62, z: 6.0,  d_ref: 1.5,  vp_cible: 7.5  },
  salmonella:         { nom: "Salmonella",                        t_ref: 62, z: 6.0,  d_ref: 0.5,  vp_cible: 2.5  },
  listeria:           { nom: "Listeria monocytogenes",            t_ref: 62, z: 5.6,  d_ref: 0.4,  vp_cible: 2    },
  byssochlamys_fulva: { nom: "Byssochlamys fulva",                t_ref: 95, z: 7.1,  d_ref: 1.8,  vp_cible: 9    },
  saccharo_jus:       { nom: "Saccharomyces cerevisiae",          t_ref: 60, z: 4.0,  d_ref: 22.5, vp_cible: 112.5 },
  saccharo_cidre_low: { nom: "Saccharomyces cerevisiae",          t_ref: 60, z: 4.0,  d_ref: 0.4,  vp_cible: 2    },
  saccharo_cidre:     { nom: "Saccharomyces cerevisiae",          t_ref: 60, z: 4.0,  d_ref: 1.1,  vp_cible: 5.5  },
};

const PRODUITS: Record<string, { nom: string; micro: string; vp_cible: number }> = {
  jus_pomme:        { nom: "Jus de pomme",      micro: "byssochlamys_fulva", vp_cible: 9   },
  cidre_doux:       { nom: "Cidre doux",         micro: "saccharo_cidre",     vp_cible: 5.5 },
  cidre_demi_sec:   { nom: "Cidre demi-sec",     micro: "saccharo_cidre",     vp_cible: 5.5 },
  cidre_brut:       { nom: "Cidre brut",         micro: "saccharo_cidre",     vp_cible: 5.5 },
  cidre_extra_brut: { nom: "Cidre extra-brut",   micro: "saccharo_cidre",     vp_cible: 5.5 },
};

// Association produit → microorganismes disponibles en mode expert
const PRODUCT_MICROS: Record<string, string[]> = {
  jus_pomme:        ["byssochlamys_fulva", "alicyclo_res", "saccharo_jus", "ecoli", "salmonella", "listeria"],
  cidre_doux:       ["saccharo_cidre", "ecoli", "salmonella"],
  cidre_demi_sec:   ["saccharo_cidre", "ecoli", "salmonella"],
  cidre_brut:       ["saccharo_cidre", "ecoli", "salmonella"],
  cidre_extra_brut: ["saccharo_cidre", "ecoli", "salmonella"],
};

const PRODUCT_LABELS: Record<string, { fr: string; en: string }> = {
  jus_pomme: { fr: "Jus de pomme", en: "Apple juice" },
  cidre_doux: { fr: "Cidre doux", en: "Sweet cider" },
  cidre_demi_sec: { fr: "Cidre demi-sec", en: "Semi-dry cider" },
  cidre_brut: { fr: "Cidre brut", en: "Dry cider" },
  cidre_extra_brut: { fr: "Cidre extra-brut", en: "Extra-dry cider" },
};

// ── Verdict logic ─────────────────────────────────────────────────────────

type Verdict = "ok" | "difficult" | "impossible";

function getVerdict(holdMin: number, pasteType: string): Verdict {
  if (pasteType === "flash") {
    if (holdMin <= 0.5) return "ok";
    if (holdMin <= 2) return "difficult";
    return "impossible";
  }
  // classique & tunnel
  if (holdMin <= 30) return "ok";
  if (holdMin <= 120) return "difficult";
  return "impossible";
}

const VERDICT_CONFIG: Record<Verdict, { stroke: string; text: string; badge: string; ring: string }> = {
  ok:         { stroke: "var(--color-primary)", text: "text-brand-primary", badge: "bg-brand-primary/8 text-brand-primary border-brand-primary/15", ring: "text-brand-primary" },
  difficult:  { stroke: "var(--color-accent)",  text: "text-brand-accent",  badge: "bg-brand-accent/8 text-brand-accent border-brand-accent/15",   ring: "text-brand-accent" },
  impossible: { stroke: "#dc2626",              text: "text-red-700",       badge: "bg-red-500/10 text-red-700 border-red-500/20",                  ring: "text-red-600" },
};

const VERDICT_LABEL: Record<Verdict, string> = {
  ok: "verdictOk",
  difficult: "verdictDifficult",
  impossible: "verdictImpossible",
};

type SearchParamReader = Pick<URLSearchParams, "get">;

function getInitialProductType(searchParams: SearchParamReader) {
  const productType = searchParams.get("product_type");
  return productType && PRODUITS[productType] ? productType : "jus_pomme";
}

function getInitialPasteType(searchParams: SearchParamReader): "flash" | "classique" | "tunnel" {
  const raw = searchParams.get("procede")?.toLowerCase();
  if (raw === "flash" || raw?.includes("flash")) return "flash";
  if (raw === "tunnel" || raw?.includes("tunnel")) return "tunnel";
  return "classique";
}

function getInitialTrouble(searchParams: SearchParamReader) {
  const raw = searchParams.get("clarification")?.toLowerCase();
  if (raw === "limpide" || raw === "clear") return false;
  return true;
}

// ── Circular gauge ────────────────────────────────────────────────────────

function HoldTimeGauge({ holdSec, holdMin, verdict }: { holdSec: number; holdMin: number; verdict: Verdict }) {
  const cfg = VERDICT_CONFIG[verdict];
  // Fill ratio: proportion of a "reasonable" range
  const maxRef = verdict === "ok" ? holdMin * 2 : (holdMin < 60 ? 60 : holdMin * 1.2);
  const ratio = Math.min(holdMin / maxRef, 1);

  const size = 130;
  const strokeW = 7;
  const r = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * ratio;

  const display = holdSec < 1
    ? { value: "< 1", unit: "sec" }
    : holdSec < 60
    ? { value: holdSec.toFixed(1), unit: "sec" }
    : holdMin < 60
    ? { value: holdMin.toFixed(1), unit: "min" }
    : { value: (holdMin / 60).toFixed(1), unit: "h" };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={strokeW} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={cfg.stroke} strokeWidth={strokeW}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold font-mono tracking-tight leading-none ${cfg.text}`}>
          {display.value}
        </span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{display.unit}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function BaremePage() {
  return (
    <Suspense>
      <BaremePageInner />
    </Suspense>
  );
}

function BaremePageInner() {
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const { user } = useAuthStore();
  const canExpert = user?.role === "ADMIN" || user?.role === "EXPERT";

  const initialProductType = getInitialProductType(searchParams);
  const initialMicroKey = searchParams.get("microorganisme");

  const [productType, setProductType] = useState(initialProductType);
  const [trouble, setTrouble] = useState(getInitialTrouble(searchParams));
  const [pasteType, setPasteType] = useState<"flash" | "classique" | "tunnel">(getInitialPasteType(searchParams));
  const [tConsigne, setTConsigne] = useState("75");
  const [expertMode, setExpertMode] = useState(Boolean(searchParams.get("t_ref") || searchParams.get("z") || initialMicroKey));
  const [microKey, setMicroKey] = useState(
    initialMicroKey && MICROORGANISMES[initialMicroKey]
      ? initialMicroKey
      : PRODUITS[initialProductType].micro
  );
  const [customTref, setCustomTref] = useState(searchParams.get("t_ref") || "");
  const [customZ, setCustomZ] = useState(searchParams.get("z") || "");

  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Auto-select default micro when product changes
  const handleProductChange = (newProduct: string) => {
    setProductType(newProduct);
    const p = PRODUITS[newProduct];
    if (p) {
      setMicroKey(p.micro);
      setCustomTref("");
      setCustomZ("");
    }
  };

  const computed = useMemo(() => {
    const produit = PRODUITS[productType];
    if (!produit) return null;
    const effectiveKey = microKey || produit.micro;
    const micro = MICROORGANISMES[effectiveKey];
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

  const verdict: Verdict | null = computed ? getVerdict(computed.holdMin, pasteType) : null;

  // Alertes
  const alertes = useMemo(() => {
    if (!computed) return [];
    const a: { type: "danger" | "warning" | "info"; msg: string }[] = [];
    if (pasteType === "flash" && computed.holdMin > 1) a.push({ type: "warning", msg: t("bareme.alertFlashTime") });
    return a;
  }, [computed, pasteType, t]);

  const produit = PRODUITS[productType];
  const productLabel = (key: string) => PRODUCT_LABELS[key]?.[locale] || PRODUITS[key]?.nom || key;
  const selectCls = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none text-xs bg-white";
  const inputCls = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent outline-none text-xs";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  // Format hold time for narrative
  const formatHold = (c: typeof computed) => {
    if (!c) return "";
    if (c.holdSec < 60) return `${c.holdSec.toFixed(1)} ${t("bareme.sec")}`;
    if (c.holdMin < 60) return `${c.holdMin.toFixed(1)} ${t("bareme.min")}`;
    return `${(c.holdMin / 60).toFixed(1)} h`;
  };

  // Build narrative
  const narrative = computed && verdict ? (() => {
    const p = {
      temp: String(computed.tC),
      time: formatHold(computed),
      product: productLabel(productType),
      process: pasteType === "flash" ? "Flash-pasteurisation" : pasteType === "classique" ? "Pasteurisation classique" : "Pasteurisation tunnel",
      micro: computed.micro.nom,
    };
    if (verdict === "ok") return t("bareme.narrativeOk", p);
    if (verdict === "difficult") return t("bareme.narrativeDifficult", p);
    return t("bareme.narrativeImpossible", p);
  })() : null;

  const vcfg = verdict ? VERDICT_CONFIG[verdict] : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-brand-gray">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
        <h1 className="font-bold text-gray-900 font-clash text-sm sm:text-base">{t("bareme.title")}</h1>
        <div className="flex items-center gap-4">
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
        {/* Backdrop for mobile */}
        {isConfigOpen && (
          <div className="lg:hidden fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-30 transition-opacity"
            onClick={() => setIsConfigOpen(false)} />
        )}

        {/* ── Left — Configuration (Drawer on mobile) ── */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 bg-white border-r border-black/[0.06] transition-all duration-300 ease-in-out flex flex-col overflow-hidden shadow-2xl lg:shadow-none
            ${isConfigOpen ? "w-[300px] sm:w-[320px] translate-x-0" : "w-0 -translate-x-full lg:translate-x-0 lg:border-r-0"}
          `}
        >
          <div className={`${isConfigOpen ? "opacity-100" : "opacity-0 lg:opacity-100"} transition-opacity duration-200 flex flex-col h-full overflow-hidden w-[300px] sm:w-[320px]`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04] lg:hidden">
              <h2 className="font-bold text-brand-text">Configuration</h2>
              <button onClick={() => setIsConfigOpen(false)} className="p-1.5 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  {canExpert && (
                    <button
                      onClick={() => setExpertMode(!expertMode)}
                      className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded transition-colors bg-gray-100 text-gray-500 hover:bg-gray-200"
                    >
                      EXPERT
                    </button>
                  )}
                </div>

                {/* 1. Produit */}
                <section>
                  <label className={labelCls}>{t("productSelector.product")}</label>
                  <select value={productType} onChange={e => handleProductChange(e.target.value)} className={selectCls}>
                    {Object.entries(PRODUITS).map(([k]) => <option key={k} value={k}>{productLabel(k)}</option>)}
                  </select>
                </section>

                {/* 2. Procédé */}
                <section>
                  <label className={labelCls}>{t("productSelector.process")}</label>
                  <select value={pasteType} onChange={e => setPasteType(e.target.value as "flash" | "classique" | "tunnel")} className={selectCls}>
                    <option value="flash">Flash-pasteurisation</option>
                    <option value="classique">Pasteurisation classique</option>
                    <option value="tunnel">Pasteurisation tunnel</option>
                  </select>
                </section>

                <div className="flex gap-1.5">
                  {[[t("bareme.turbid"), true], [t("bareme.clear"), false]].map(([label, val]) => (
                    <button key={String(val)} onClick={() => setTrouble(val as boolean)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        trouble === val ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-4 my-1 border-t border-black/[0.04]" />

              <div className="px-4 py-3 space-y-3">
                {/* 3. Température consigne */}
                <section>
                  <label className={labelCls}>{t("bareme.tempConsigne")}</label>
                  <div className="relative">
                    <input type="number" step="1" min="50" max="100" value={tConsigne}
                      onChange={e => setTConsigne(e.target.value)}
                      className={`${inputCls} pr-9 text-center font-bold tabular-nums`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">°C</span>
                  </div>
                </section>

                {/* Expert params — only if expert/admin + toggle on */}
                {canExpert && expertMode && (
                  <section className="pt-1.5 border-t border-gray-100 space-y-2.5">
                    <div>
                      <label className={labelCls}>{t("bareme.microTarget")}</label>
                      <select value={microKey} onChange={e => setMicroKey(e.target.value)} className={selectCls}>
                        {(PRODUCT_MICROS[productType] || []).map((k) => {
                          const v = MICROORGANISMES[k];
                          if (!v) return null;
                          const isDefault = k === PRODUITS[productType]?.micro;
                          return (
                            <option key={k} value={k}>
                              {v.nom} — D={v.d_ref} min @ {v.t_ref}°C{isDefault ? " ✓" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>{t("bareme.tref")}</label>
                        <input type="number" step="0.1" placeholder="60" value={customTref}
                          onChange={e => setCustomTref(e.target.value)}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>{t("bareme.z")}</label>
                        <input type="number" step="0.1" placeholder="7" value={customZ}
                          onChange={e => setCustomZ(e.target.value)}
                          className={inputCls} />
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
            <div className="lg:hidden p-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="w-full py-2.5 text-sm flex items-center justify-center gap-2 rounded-lg font-bold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                Voir le résultat
              </button>
            </div>
          </div>
        </aside>

        {/* Toggle Button (Desktop) */}
        <button
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className={`hidden lg:flex absolute top-8 w-8 h-8 bg-white border border-black/[0.06] rounded-full items-center justify-center shadow-sm z-50 hover:bg-gray-50 transition-all duration-300 ease-in-out
            ${isConfigOpen ? "left-[284px] sm:left-[304px]" : "left-4"}
          `}
        >
          {isConfigOpen ? <ChevronLeft className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>

        {/* ── Right — Verdict ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Mobile Config Toggle */}
          {!isConfigOpen && (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="lg:hidden fixed bottom-6 right-6 z-30 w-12 h-12 bg-brand-primary text-white rounded-full shadow-lg flex items-center justify-center animate-in zoom-in duration-300"
            >
              <Settings2 className="w-6 h-6" />
            </button>
          )}
          {computed && verdict && vcfg ? (
            <div className="max-w-xl mx-auto space-y-4">

              {/* ── Primary: Gauge + Narrative ── */}
              <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
                <div className="px-4 py-6 sm:px-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Circular gauge */}
                    <HoldTimeGauge holdSec={computed.holdSec} holdMin={computed.holdMin} verdict={verdict} />

                    {/* Right: verdict + narrative */}
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${vcfg.badge}`}>
                          {t(`bareme.${VERDICT_LABEL[verdict]}`)}
                        </span>
                        <span className="text-xs font-mono text-gray-400">
                          {t("bareme.atTemp", { temp: String(computed.tC) })}
                        </span>
                      </div>

                      <p className="text-[13px] text-gray-600 leading-relaxed">
                        {narrative}
                      </p>

                      <p className="text-[11px] text-gray-400 mt-2 italic">
                        VP cible : {computed.vp} UP
                      </p>
                    </div>
                  </div>
                </div>

                {/* Context strip */}
                <div className="px-4 sm:px-6 py-2.5 bg-gray-50/80 border-t border-black/[0.04] flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-1 text-[11px] text-gray-400 text-center">
                  <span>{t("bareme.vpCible")} <strong className="text-gray-600">{computed.vp} {t("bareme.up")}</strong></span>
                  <span>{t("bareme.lethalRate")} <strong className="text-gray-600">{computed.L}</strong></span>
                  <span className="hidden sm:inline">{t("bareme.process")} <strong className="text-gray-600">{pasteType === "flash" ? "Flash-pasteurisation" : pasteType === "classique" ? "Pasteurisation classique" : "Pasteurisation tunnel"}</strong></span>
                  <span className="hidden sm:inline">{trouble ? t("bareme.turbid") : t("bareme.clear")}</span>
                </div>
              </div>

              {/* ── Alerts — integrated, not afterthought ── */}
              {alertes.length > 0 && (
                <div className="space-y-2">
                  {alertes.map((a, i) => {
                    const Icon = a.type === "info" ? Info : AlertTriangle;
                    const cls = a.type === "danger"
                      ? "bg-red-50 border-red-200/60 text-red-700"
                      : a.type === "warning"
                      ? "bg-amber-50 border-amber-200/60 text-amber-700"
                      : "bg-blue-50 border-blue-200/60 text-blue-700";
                    return (
                      <div key={i} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-[12px] leading-relaxed ${cls}`}>
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        {a.msg}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Technical params — bottom, compact ── */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-0 rounded-lg border border-black/[0.06] bg-white overflow-hidden divide-x divide-y sm:divide-y-0 divide-black/[0.06]">
                <div className="px-4 py-2.5 col-span-2 sm:flex-1">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t("bareme.micro")}</p>
                  <p className="text-xs font-semibold text-brand-text truncate italic">{computed.micro.nom}</p>
                </div>
                <div className="px-4 py-2.5 sm:flex-1">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t("bareme.tref")}</p>
                  <span className="text-base sm:text-lg font-bold font-mono text-brand-text tracking-tight">{computed.tRef}</span>
                  <span className="text-[10px] text-gray-400 ml-0.5">°C</span>
                </div>
                <div className="px-4 py-2.5 sm:flex-1">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t("bareme.z")}</p>
                  <span className="text-base sm:text-lg font-bold font-mono text-brand-text tracking-tight">{computed.z}</span>
                  <span className="text-[10px] text-gray-400 ml-0.5">°C</span>
                </div>
                <div className="hidden sm:block px-4 py-2.5 sm:flex-1">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">D (Tref)</p>
                  <span className="text-lg font-bold font-mono text-brand-text tracking-tight">{computed.micro.d_ref}</span>
                  <span className="text-[10px] text-gray-400 ml-0.5">min</span>
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
      <HelpModal
        helpKey="aide_bareme"
        defaultContent={t("bareme.defaultHelp")}
        title={t("bareme.helpTitle")}
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}
