"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Info, ShieldCheck, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";

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

// ── Verdict logic ─────────────────────────────────────────────────────────

type Verdict = "ok" | "difficult" | "impossible";

function getVerdict(holdMin: number, pasteType: string): Verdict {
  if (pasteType === "flash") {
    if (holdMin <= 0.5) return "ok";
    if (holdMin <= 2) return "difficult";
    return "impossible";
  }
  // tunnel
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

  const display = holdSec < 60
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
  const { t, locale } = useI18n();
  const { user } = useAuthStore();
  const canExpert = user?.role === "ADMIN" || user?.role === "EXPERT";

  const [productType, setProductType] = useState("jus_pomme");
  const [trouble, setTrouble] = useState(true);
  const [pasteType, setPasteType] = useState<"flash" | "tunnel">("flash");
  const [tConsigne, setTConsigne] = useState("75");
  const [expertMode, setExpertMode] = useState(false);
  const [microKey, setMicroKey] = useState("");
  const [customTref, setCustomTref] = useState("");
  const [customZ, setCustomZ] = useState("");

  const [isConfigOpen, setIsConfigOpen] = useState(true);

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
      process: pasteType === "flash" ? t("bareme.flash") : t("bareme.tunnel"),
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
          {canExpert && (
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={expertMode} onChange={e => setExpertMode(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-brand-accent" />
              <span className="hidden sm:inline font-semibold text-brand-accent">{t("bareme.expertMode")}</span>
              <span className="sm:hidden font-semibold text-brand-accent">EXPERT</span>
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Backdrop for mobile */}
        {isConfigOpen && (
          <div className="lg:hidden absolute inset-0 bg-gray-900/20 backdrop-blur-sm z-30"
            onClick={() => setIsConfigOpen(false)} />
        )}

        {/* ── Left — Configuration (Drawer on mobile) ── */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-40 w-72 sm:w-80 flex-shrink-0 border-r border-gray-100 bg-white transition-transform duration-300 ease-in-out
          ${isConfigOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-50">
              <span className="font-bold text-brand-text">Paramètres</span>
              <button onClick={() => setIsConfigOpen(false)} className="p-1 text-gray-400">
                <ChevronDown className="w-6 h-6 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* HERO — T° consigne — the most important input */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{t("bareme.tempConsigne")}</p>
            <div className="relative">
              <input type="number" step="1" min="50" max="100" value={tConsigne}
                onChange={e => setTConsigne(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-brand-primary/30 rounded-xl text-2xl font-extrabold text-brand-text text-center outline-none focus:border-brand-primary transition-colors tabular-nums" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">°C</span>
            </div>
          </section>

          {/* Produit */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
              <p className="text-[11px] font-bold text-gray-600">{t("bareme.stepProduct")}</p>
            </div>
            <select value={productType} onChange={e => setProductType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary transition-colors">
              {Object.entries(PRODUITS).map(([k]) => <option key={k} value={k}>{productLabel(k)}</option>)}
            </select>
            <div className="flex gap-1.5 mt-2.5">
              {[[t("bareme.turbid"), true], [t("bareme.clear"), false]].map(([label, val]) => (
                <button key={String(val)} onClick={() => setTrouble(val as boolean)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    trouble === val ? "bg-brand-primary text-white shadow-sm" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}>
                  {label as string}
                </button>
              ))}
            </div>
          </section>

          {/* Procédé */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
              <p className="text-[11px] font-bold text-gray-600">{t("bareme.stepProcess")}</p>
            </div>
            <div className="flex gap-1.5">
              {[[t("bareme.flash"), "flash"], [t("bareme.tunnel"), "tunnel"]].map(([label, val]) => (
                <button key={val as string} onClick={() => setPasteType(val as "flash" | "tunnel")}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    pasteType === val ? "bg-brand-accent text-white shadow-sm" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}>
                  {label as string}
                </button>
              ))}
            </div>
          </section>

          {/* Expert params — only if expert/admin + toggle on */}
          {canExpert && expertMode && (
            <section className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <ChevronDown className="w-3.5 h-3.5 text-brand-accent" />
                <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">{t("bareme.expertParams")}</p>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">{t("bareme.microTarget")}</p>
                  <select value={microKey} onChange={e => setMicroKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[11px] outline-none focus:border-brand-accent transition-colors">
                    <option value="">{t("bareme.microDefault", { name: `${MICROORGANISMES[produit?.micro]?.nom} — D=${MICROORGANISMES[produit?.micro]?.d_ref} min` })}</option>
                    {Object.entries(MICROORGANISMES).map(([k, v]) => (
                      <option key={k} value={k}>{v.nom} — D={v.d_ref} min @ {v.t_ref}°C</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">{t("bareme.tref")}</p>
                    <input type="number" step="0.1" placeholder="60" value={customTref}
                      onChange={e => setCustomTref(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-accent transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">{t("bareme.z")}</p>
                    <input type="number" step="0.1" placeholder="7" value={customZ}
                      onChange={e => setCustomZ(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-accent transition-colors" />
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
            {/* View Result Button (Mobile only) */}
            <div className="lg:hidden p-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/20"
              >
                Voir le résultat
              </button>
            </div>
          </div>
        </div>

        {/* ── Right — Verdict ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Mobile Config Toggle */}
          {!isConfigOpen && (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="lg:hidden fixed bottom-6 right-6 z-30 w-12 h-12 bg-brand-accent text-white rounded-full shadow-lg flex items-center justify-center animate-in zoom-in duration-300"
            >
              <Info className="w-6 h-6" />
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
                        {t("bareme.narrativeContext", { micro: computed.micro.nom, vp: String(computed.vp) })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Context strip */}
                <div className="px-4 sm:px-6 py-2.5 bg-gray-50/80 border-t border-black/[0.04] flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-1 text-[11px] text-gray-400 text-center">
                  <span>{t("bareme.vpCible")} <strong className="text-gray-600">{computed.vp} {t("bareme.up")}</strong></span>
                  <span>{t("bareme.lethalRate")} <strong className="text-gray-600">{computed.L}</strong></span>
                  <span className="hidden sm:inline">{t("bareme.process")} <strong className="text-gray-600">{pasteType === "flash" ? t("bareme.flash") : t("bareme.tunnel")}</strong></span>
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
    </div>
  );
}
