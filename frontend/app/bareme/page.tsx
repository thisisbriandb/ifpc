"use client";

import { Suspense, useState, useMemo, useEffect, useCallback } from "react";
import { AlertTriangle, Info, ShieldCheck, HelpCircle, ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import HelpModal from "@/components/HelpModal";
import { getProductConfig, getAnalysisById } from "@/lib/api";
import { formatHoldTime } from "@/lib/pasteurisation";
import {
  MICROORGANISMES,
  PRODUITS,
  PRODUCT_MICROS,
  normaliserProduit,
} from "@/lib/referentiel";

// ── Données de référence ──────────────────────────────────────────────────
// Le référentiel scientifique vit dans lib/referentiel.ts, dont la conformité
// au document `referentiel-scientifique.md` §4 est vérifiée par les tests.

// Les clés héritées restent traduites : d'anciennes analyses les portent encore.
const PRODUCT_LABELS: Record<string, { fr: string; en: string }> = {
  jus_pomme: { fr: "Jus de pomme", en: "Apple juice" },
  cidre_doux: { fr: "Cidre doux et demi-sec", en: "Sweet and semi-dry cider" },
  cidre_brut: { fr: "Cidre brut et extra-brut", en: "Dry and extra-dry cider" },
  cidre_demi_sec: { fr: "Cidre doux et demi-sec", en: "Sweet and semi-dry cider" },
  cidre_extra_brut: { fr: "Cidre brut et extra-brut", en: "Dry and extra-dry cider" },
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

function formatHours(hours: number) {
  return hours > 1000 ? hours.toExponential(2) : hours.toFixed(1);
}

type SearchParamReader = Pick<URLSearchParams, "get">;

function getInitialProductType(searchParams: SearchParamReader) {
  const productType = normaliserProduit(searchParams.get("product_type") ?? "");
  return PRODUITS[productType] ? productType : "jus_pomme";
}

function getInitialPasteType(searchParams: SearchParamReader): "flash" | "classique" | "tunnel" {
  const raw = searchParams.get("procede")?.toLowerCase();
  if (raw === "flash" || raw?.includes("flash")) return "flash";
  if (raw === "tunnel" || raw?.includes("tunnel")) return "tunnel";
  return "classique";
}

// ── Circular gauge ────────────────────────────────────────────────────────

function HoldTimeGauge({ holdMin, verdict }: { holdMin: number; verdict: Verdict }) {
  const { t } = useI18n();
  const cfg = VERDICT_CONFIG[verdict];
  // Fill ratio: proportion of a "reasonable" range
  const maxRef = verdict === "ok" ? holdMin * 2 : (holdMin < 60 ? 60 : holdMin * 1.2);
  const ratio = Math.min(holdMin / maxRef, 1);

  const size = 130;
  const strokeW = 7;
  const r = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * ratio;

  const hold = formatHoldTime(holdMin);
  const display = { value: hold.value, unit: t(`bareme.${hold.unit}`) };

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

interface MicroBaremeEval {
  key: string;
  nom: string;
  t_ref: number;
  z: number;
  d_ref: number;
  vp_cible: number;
  L: number;
  holdMin: number;
  holdSec: number;
  verdict: Verdict;
}

function BaremePageInner() {
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const { user } = useAuthStore();
  const canExpert = user?.role === "ADMIN" || user?.role === "EXPERT";

  const initialProductType = getInitialProductType(searchParams);
  const initialMicroKey = searchParams.get("microorganisme");

  const [productType, setProductType] = useState(initialProductType);
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
  const [vpCibleConfig, setVpCibleConfig] = useState<Record<string, number>>({});

  useEffect(() => {
    getProductConfig()
      .then((data: { productType: string; vpCible: number }[]) => {
        const map: Record<string, number> = {};
        data.forEach(c => { map[c.productType] = c.vpCible; });
        setVpCibleConfig(map);
      })
      .catch(() => {});
  }, []);

  // Fetch history entry if history query param is present
  useEffect(() => {
    const historyId = searchParams.get("history");
    if (!historyId) return;
    getAnalysisById(parseInt(historyId, 10))
      .then((detail) => {
        if (detail.parametres) {
          try {
            const p = typeof detail.parametres === "string" ? JSON.parse(detail.parametres) : detail.parametres;
            if (p.product_type) setProductType(normaliserProduit(p.product_type));
            if (p.procede) setPasteType(p.procede);
            if (p.microorganisme && MICROORGANISMES[p.microorganisme]) setMicroKey(p.microorganisme);
            if (p.t_ref) setCustomTref(String(p.t_ref));
            if (p.z) setCustomZ(String(p.z));
            if (p.t_consigne) setTConsigne(String(p.t_consigne));
            if (p.t_ref || p.z || p.microorganisme) setExpertMode(true);
          } catch {}
        }
      })
      .catch(() => {});
  }, [searchParams]);

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
    const tC = parseFloat(tConsigne);
    if (!tC) return null;

    const isJusPommeMulti = productType === "jus_pomme" && !customTref && !customZ;

    if (isJusPommeMulti) {
      const multimicroKeys = ["saccharo_jus", "ecoli", "byssochlamys_fulva", "alicyclo_std"];
      const evaluations: MicroBaremeEval[] = multimicroKeys.map((key) => {
        const m = MICROORGANISMES[key];
        // VP cible du microorganisme, appliquée telle quelle : la majoration
        // de 20 % réservée aux produits troubles a été supprimée.
        const vp = m.vp_cible; // Standard 15-log reduction: VP = 15 * D_ref
        const L = Math.pow(10, (tC - m.t_ref) / m.z);
        const holdMin = vp / L;
        const holdSec = holdMin * 60;
        const v = getVerdict(holdMin, pasteType);
        return {
          key,
          nom: m.nom,
          t_ref: m.t_ref,
          z: m.z,
          d_ref: m.d_ref,
          vp_cible: +vp.toFixed(2),
          L: +L.toFixed(4),
          holdMin,
          holdSec,
          verdict: v,
        };
      });

      let limiting = evaluations[0];
      for (const ev of evaluations) {
        if (ev.holdMin > limiting.holdMin) {
          limiting = ev;
        }
      }

      return {
        isMulti: true,
        evaluations,
        limiting,
        micro: { nom: limiting.nom, t_ref: limiting.t_ref, z: limiting.z, d_ref: limiting.d_ref, vp_cible: limiting.vp_cible },
        tRef: limiting.t_ref,
        z: limiting.z,
        vp: limiting.vp_cible,
        tC,
        L: limiting.L,
        holdMin: limiting.holdMin,
        holdSec: limiting.holdSec,
      };
    }

    // Single micro mode (Cidre / Expert mode)
    const effectiveKey = microKey || produit.micro;
    const micro = MICROORGANISMES[effectiveKey];
    if (!micro) return null;
    const tRef = customTref ? parseFloat(customTref) : micro.t_ref;
    const z    = customZ    ? parseFloat(customZ)    : micro.z;
    if (!tRef || !z) return null;

    const vp = micro.vp_cible; // Standard 15-log reduction: VP = 15 * D_ref
    const L = Math.pow(10, (tC - tRef) / z);
    const holdMin = vp / L;
    return {
      isMulti: false,
      micro,
      tRef,
      z,
      vp: +vp.toFixed(2),
      tC,
      L: +L.toFixed(4),
      holdMin,
      holdSec: holdMin * 60,
    };
  }, [productType, tConsigne, microKey, customTref, customZ, expertMode, vpCibleConfig, pasteType]);

  const handleReset = useCallback(() => {
    setProductType("jus_pomme");
    setPasteType("classique");
    setTConsigne("75");
    setMicroKey("");
    setCustomTref("");
    setCustomZ("");
    setExpertMode(false);
  }, []);

  const verdict: Verdict | null = computed ? getVerdict(computed.holdMin, pasteType) : null;

  // Alertes
  const alertes = useMemo(() => {
    if (!computed) return [];
    const a: { type: "danger" | "warning" | "info"; msg: string }[] = [];
    if (pasteType === "flash" && computed.holdMin > 1) a.push({ type: "warning", msg: t("bareme.alertFlashTime") });
    return a;
  }, [computed, pasteType, t]);

  const productLabel = (key: string) => {
    const l = PRODUCT_LABELS[key];
    return l ? (l[locale as "fr" | "en"] || l.fr) : PRODUITS[key]?.nom || key;
  };

  const selectCls = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none text-xs bg-white";
  const inputCls = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent outline-none text-xs";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  // Format hold time for narrative and cards — même règle que la jauge, et
  // indépendante du procédé : la valeur seule décide de l'unité.
  const formatHold = (c: { holdMin: number }) => {
    const hold = formatHoldTime(c.holdMin);
    return `${hold.value} ${t(`bareme.${hold.unit}`)}`;
  };

  // Build narrative
  const narrative = computed && verdict ? (() => {
    const microName = computed.isMulti && computed.limiting ? computed.limiting.nom : computed.micro.nom;
    const p = {
      temp: String(computed.tC),
      time: formatHold(computed),
      product: productLabel(productType),
      process: pasteType === "flash" ? "Flash-pasteurisation" : pasteType === "classique" ? "Pasteurisation classique" : "Pasteurisation tunnel",
      micro: microName,
    };
    if (computed.isMulti) {
      if (verdict === "ok") return `À ${p.temp}°C, le temps de maintien recommandé pour assainir le Jus de pomme (4 microorganismes de référence) est de ${p.time}, déterminé par le facteur limitant (${p.micro}).`;
      if (verdict === "difficult") return `À ${p.temp}°C, le temps de maintien nécessaire pour le Jus de pomme est exigeant (${p.time}), le facteur limitant étant ${p.micro}.`;
      return `À ${p.temp}°C, le temps de maintien global pour le Jus de pomme (${p.time}) est réalisable mais nécessite un changement de matériel avec le procédé ${p.process}, en raison des exigences du facteur limitant (${p.micro}).`;
    }
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
        <div className="flex items-center gap-2">
          {canExpert && (
            <button
              onClick={() => setExpertMode(!expertMode)}
              className={`hidden lg:block px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                expertMode
                  ? "bg-brand-primary text-white shadow-sm"
                  : "bg-white border border-black/[0.06] text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              EXPERT
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04]">
              <h2 className="font-bold text-xs uppercase tracking-wider text-gray-500">Configuration</h2>
              <div className="flex items-center gap-1.5">
                {canExpert && (
                  <button
                    onClick={() => setExpertMode(!expertMode)}
                    className={`lg:hidden px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      expertMode
                        ? "bg-brand-primary text-white shadow-sm"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    EXPERT
                  </button>
                )}
                <button onClick={() => setIsConfigOpen(false)} className="p-1 text-gray-400 lg:hidden">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-3 space-y-3">

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
                {t("bareme.viewVerdict")}
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
            <div className="max-w-3xl mx-auto space-y-4">

              {/* ── Alerts ── */}
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

              {/* ── Microorganism Evaluation Grid (Unified structure for Jus de Pomme and Cidre) ── */}
              {(() => {
                const evalList: MicroBaremeEval[] = computed.isMulti && computed.evaluations
                  ? computed.evaluations
                  : [{
                      key: microKey || PRODUITS[productType]?.micro || "single",
                      nom: computed.micro.nom,
                      t_ref: computed.tRef,
                      z: computed.z,
                      d_ref: computed.micro.d_ref,
                      vp_cible: computed.vp,
                      L: computed.L,
                      holdMin: computed.holdMin,
                      holdSec: computed.holdSec,
                      verdict: verdict,
                    }];

                return (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Temps de maintien requis par microorganisme
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {evalList.map((item) => {
                        const vcfgItem = VERDICT_CONFIG[item.verdict];
                        const timeStr = formatHold(item);
                        const procName = pasteType === "flash" ? "Flash-pasteurisation" : pasteType === "classique" ? "Pasteurisation classique" : "Pasteurisation tunnel";
                        
                        const cardMessage = item.verdict === "ok"
                          ? `À ${computed.tC}°C, le temps de maintien nécessaire (${timeStr}) est parfaitement réalisable en ${procName}.`
                          : item.verdict === "difficult"
                          ? `À ${computed.tC}°C, le temps de maintien nécessaire (${timeStr}) est exigeant en ${procName}. Envisagez d'augmenter la température.`
                          : `À ${computed.tC}°C, le temps de maintien nécessaire (${timeStr}) est réalisable mais nécessite un changement de matériel en ${procName} (ou une augmentation de la température).`;

                        return (
                          <div
                            key={item.key}
                            className="bg-white rounded-2xl border border-black/[0.06] p-5 flex flex-col justify-between space-y-4 shadow-sm transition-all"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3 gap-2">
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                                  Microorganisme de référence
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-gray-900 italic leading-snug">
                                  {item.nom}
                                </h4>
                              </div>
                              <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md border shrink-0 ${vcfgItem.badge}`}>
                                {t(`bareme.${VERDICT_LABEL[item.verdict]}`)}
                              </span>
                            </div>

                            {/* Body — Temps de maintien + Interprétation propre */}
                            <div className="space-y-2 flex-1">
                              <div className="flex items-baseline justify-between">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                  Temps de maintien requis
                                </span>
                                <span className="text-base sm:text-lg font-bold font-mono text-gray-900">
                                  {timeStr}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed font-medium">
                                {cardMessage}
                              </p>
                            </div>

                            {/* Footer — Paramètres de référence */}
                            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="text-[10px] font-mono text-gray-500 flex flex-wrap items-center gap-2">
                                <span>Tref : {item.t_ref}°C ; Z : {item.z}°C ; D : {item.d_ref} min.</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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
