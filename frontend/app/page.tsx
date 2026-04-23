"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  ArrowRight, Clock, ChevronDown,
  Thermometer, FlaskConical, BarChart3,
  Pipette, ScanEye, Palette,
  Shield, Users, Settings,
} from "lucide-react";
import { getHistory, type HistoryEntry } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Types ────────────────────────────────────────────────────────────────────

interface RecentActivity {
  id: string;
  date: string;
  type: "controle" | "bareme";
  label: string;
  lotIdentifier?: string;
  produit?: string;
  procede?: string;
  statut?: string;
  vp?: number;
  vpCible?: number;
  fromDb?: boolean;
  resultJson?: string;
  parametres?: string;
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  conforme:    { bg: "bg-brand-primary/10", text: "text-brand-primary" },
  vigilance:   { bg: "bg-brand-accent/10",  text: "text-brand-accent"  },
  insuffisant: { bg: "bg-red-50",            text: "text-red-700"       },
};

interface HistorySubMeta { type: string; dot: string; bar: string; }
interface HistoryParentMeta { key: string; icon: any; accent: string; iconColor: string; subModules: HistorySubMeta[]; }

const HISTORY_MODULES: HistoryParentMeta[] = [
  {
    key: "pasteurisation",
    icon: Thermometer,
    accent: "border-l-[3px] border-brand-primary",
    iconColor: "text-brand-primary",
    subModules: [
      { type: "controle", dot: "bg-brand-primary",     bar: "bg-brand-primary/30"  },
      { type: "bareme",   dot: "bg-brand-accent",      bar: "bg-brand-accent/30"   },
    ],
  },
];

// ── Module data ──────────────────────────────────────────────────────────────

interface SubModule {
  href: string;
  label: string;
  icon: any;
}

interface Module {
  key: string;
  label: string;
  icon: any;
  gradient: string;
  ring: string;
  subColor: string;
  subModules: SubModule[];
  adminOnly?: boolean;
}


// ── Arc Module Component ─────────────────────────────────────────────────────

function ArcModule({ mod }: { mod: Module }) {
  const [open, setOpen] = useState(false);
  const Icon = mod.icon;
  const count = mod.subModules.length;

  // Compute arc positions for sub-modules (semi-circle below parent)
  const ARC_RADIUS = 80; // Slightly smaller for mobile
  const getArcPosition = (index: number, total: number) => {
    // Spread evenly across 180° arc (π), centered below
    const startAngle = Math.PI * 0.1;
    const endAngle   = Math.PI * 0.9;
    const angle = total === 1
      ? Math.PI / 2
      : startAngle + (index / (total - 1)) * (endAngle - startAngle);
    return {
      x: -Math.cos(angle) * ARC_RADIUS,
      y: Math.sin(angle) * ARC_RADIUS,
    };
  };

  return (
    <div
      className="relative flex flex-col items-center z-10"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ width: 160, height: 120 }}
    >
      {/* Main module icon */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-br ${mod.gradient} text-white shadow-lg
          flex items-center justify-center transition-all duration-300
          hover:scale-110 hover:shadow-xl ring-4 ${mod.ring}
          ${open ? "scale-110 shadow-xl" : ""}`}
      >
        <Icon className="w-7 h-7" />
      </button>
      <span className="mt-2 text-xs font-bold text-gray-600 tracking-wide text-center px-2">{mod.label}</span>

      {/* Semi-circle arc of sub-modules */}
      <div className="absolute top-8 left-1/2 z-20" style={{ width: 0, height: 0 }}>
        {mod.subModules.map((sub, i) => {
          const { x, y } = getArcPosition(i, count);
          const SubIcon = sub.icon;
          return (
            <Link
              key={sub.href + sub.label}
              href={sub.href}
              className={`absolute flex flex-col items-center transition-all duration-300 ease-out
                ${open
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "opacity-0 scale-50 pointer-events-none"
                }`}
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                transitionDelay: open ? `${i * 60}ms` : "0ms",
              }}
            >
              <div className={`w-11 h-11 rounded-xl border ${mod.subColor} flex items-center justify-center shadow-sm transition-all hover:scale-110 hover:shadow-md`}>
                <SubIcon className="w-5 h-5" />
              </div>
              <span className="mt-1 text-[9px] font-semibold text-gray-500 whitespace-nowrap">{sub.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Decorative arc line (SVG) */}
      <svg
        className={`absolute top-12 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${open ? "opacity-20" : "opacity-0"}`}
        width="180" height="100" viewBox="-90 -10 180 100"
        fill="none"
      >
        <path
          d={`M ${ARC_RADIUS * Math.cos(Math.PI * 0.1)} ${ARC_RADIUS * Math.sin(Math.PI * 0.1)} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 0 ${ARC_RADIUS * Math.cos(Math.PI * 0.9)} ${ARC_RADIUS * Math.sin(Math.PI * 0.9)}`}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="text-gray-400"
        />
      </svg>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PREVIEW_COUNT = 3;

export default function Home() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({ pasteurisation: true });

  const modules: Module[] = [
    {
      key: "pasto",
      label: t("home.modules.pasteurisation"),
      icon: Thermometer,
      gradient: "from-brand-primary to-brand-primary/80",
      ring: "ring-brand-primary/20",
      subColor: "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border-brand-primary/20",
      subModules: [
        { href: "/controle", label: t("home.modules.calculVP"), icon: FlaskConical },
        { href: "/bareme",   label: t("home.modules.bareme"),   icon: BarChart3 },
      ],
    },
    {
      key: "colori",
      label: t("home.modules.colorimetrie"),
      icon: Palette,
      gradient: "from-brand-accent to-brand-sand",
      ring: "ring-brand-accent/20",
      subColor: "bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 border-brand-accent/20",
      subModules: [
        { href: "#", label: t("home.modules.mesure"),  icon: Pipette },
        { href: "#", label: t("home.modules.analyse"), icon: ScanEye },
      ],
    },
    {
      key: "admin",
      label: t("home.modules.admin"),
      icon: Shield,
      gradient: "from-gray-600 to-gray-500",
      ring: "ring-gray-200",
      subColor: "bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200",
      adminOnly: true,
      subModules: [
        { href: "/admin",  label: t("home.modules.users"),  icon: Users },
        { href: "/expert", label: t("home.modules.config"), icon: Settings },
      ],
    },
  ];

  useEffect(() => {
    let cancelled = false;
    async function loadActivities() {
      if (user) {
        try {
          const dbEntries = await getHistory();
          if (!cancelled && Array.isArray(dbEntries) && dbEntries.length > 0) {
            setActivities(dbEntries.map((e: HistoryEntry) => ({
              id: String(e.id),
              date: e.date,
              type: e.type,
              label: e.label,
              lotIdentifier: e.lotIdentifier,
              statut: e.statut,
              vp: e.vp,
              vpCible: e.vpCible,
              parametres: e.parametres,
              fromDb: true,
            })));
            return;
          }
        } catch {}
      }
      try {
        const stored = localStorage.getItem("ifpc_recent_activities");
        if (!cancelled && stored) setActivities(JSON.parse(stored));
      } catch {
        if (!cancelled) setActivities([]);
      }
    }
    loadActivities();
    return () => { cancelled = true; };
  }, [user]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("home.greetingMorning");
    if (h < 18) return t("home.greetingAfternoon");
    return t("home.greetingEvening");
  };

  const visibleModules = modules.filter((m) => !m.adminOnly || user?.role === "ADMIN");

  const productLabels: Record<string, { fr: string; en: string }> = {
    jus_pomme: { fr: "Jus de pomme", en: "Apple juice" },
    cidre_doux: { fr: "Cidre doux", en: "Sweet cider" },
    cidre_demi_sec: { fr: "Cidre demi-sec", en: "Semi-dry cider" },
    cidre_brut: { fr: "Cidre brut", en: "Dry cider" },
    cidre_extra_brut: { fr: "Cidre extra-brut", en: "Extra-dry cider" },
  };

  const processLabels: Record<string, { fr: string; en: string }> = {
    flash: { fr: "Pasteurisation flash", en: "Flash pasteurisation" },
    classique: { fr: "Pasteurisation classique", en: "Conventional pasteurisation" },
    tunnel: { fr: "Tunnel / douchette", en: "Tunnel / spray" },
  };

  const productNameToKey: Record<string, string> = Object.fromEntries(
    Object.entries(productLabels).flatMap(([key, values]) => Object.values(values).map((name) => [name, key]))
  );

  const processNameToKey: Record<string, string> = Object.fromEntries(
    Object.entries(processLabels).flatMap(([key, values]) => Object.values(values).map((name) => [name, key]))
  );

  const translateProduct = (value?: string) => {
    if (!value) return value;
    const key = productNameToKey[value];
    return key ? productLabels[key][locale] : value;
  };

  const translateProcess = (value?: string) => {
    if (!value) return value;
    const key = processNameToKey[value];
    return key ? processLabels[key][locale] : value;
  };

  const activityMeta = (activity: RecentActivity) => {
    let parametres: any = null;
    try {
      parametres = activity.parametres ? JSON.parse(activity.parametres) : null;
    } catch {}

    const produit = translateProduct(parametres?.produit || activity.produit);
    const procede = translateProcess(parametres?.procede || activity.procede);
    const title = activity.lotIdentifier || produit || activity.label;

    return { produit, procede, title };
  };

  return (
    <div className="min-h-screen bg-brand-gray px-4 sm:px-8 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-10 sm:space-y-12">

        {/* Welcome */}
        <header className="text-center">
          <Image src="/assets/logo.png" alt="IFPC" width={64} height={64} className="mx-auto mb-4 w-12 h-12 sm:w-16 sm:h-16" />
          <h1 className="text-xl sm:text-2xl font-bold text-brand-text">
            {greeting()}{user ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">{t("home.subtitle")}</p>
        </header>

        {/* Module arcs */}
        <div className="flex justify-center gap-6 sm:gap-12 flex-wrap pt-2 overflow-visible relative z-10">
          {visibleModules.map((mod) => (
            <ArcModule key={mod.key} mod={mod} />
          ))}
        </div>

        {/* Recent Activities */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("home.recentActivities")}</h2>
            </div>
            {activities.length > 0 && (
              <Link
                href="/historique"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-primary transition-colors"
              >
                {t("home.viewAll")}
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {(() => {
            const grouped = activities.reduce<Record<string, RecentActivity[]>>((acc, a) => {
              if (!acc[a.type]) acc[a.type] = [];
              acc[a.type].push(a);
              return acc;
            }, {});
            Object.values(grouped).forEach(items =>
              items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            );

            return (
              <div className="space-y-2">
                {HISTORY_MODULES.map(parent => {
                  const ParentIcon = parent.icon;
                  const totalEntries = parent.subModules.reduce((sum, sub) => sum + (grouped[sub.type]?.length ?? 0), 0);
                  const isOpen = openModules[parent.key] ?? false;
                  return (
                    <div key={parent.key} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${parent.accent}`}>

                      {/* ── Accordion trigger ── */}
                      <button
                        onClick={() => setOpenModules(prev => ({ ...prev, [parent.key]: !isOpen }))}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors text-left"
                      >
                        <ParentIcon className={`w-4 h-4 shrink-0 ${parent.iconColor}`} />
                        <span className="flex-1 text-sm font-semibold text-gray-700">{t(`home.modules.${parent.key}`)}</span>
                        {totalEntries > 0 && (
                          <span className="text-[11px] font-semibold text-gray-400 tabular-nums mr-1">{totalEntries}</span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {/* ── Expanded content ── */}
                      {isOpen && (
                        <div className="border-t border-gray-100">
                          {parent.subModules.map((sub, subIdx) => {
                            const items = grouped[sub.type] ?? [];
                            const visible = items.slice(0, PREVIEW_COUNT);
                            return (
                              <div key={sub.type} className={subIdx > 0 ? "border-t border-gray-100" : ""}>

                                {/* Sub-module label */}
                                <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sub.dot}`} />
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {t(`home.moduleMeta.${sub.type}`)}
                                  </span>
                                </div>

                                {items.length === 0 ? (
                                  <p className="px-4 pb-3 text-[11px] text-gray-300 italic">{t("home.noEntries")}</p>
                                ) : (
                                  <>
                                    <div className="divide-y divide-gray-50">
                                      {visible.map((a) => {
                                        const badge = a.statut ? STATUS_BADGE[a.statut] : undefined;
                                        const meta = activityMeta(a);
                                        const handleClick = () => {
                                          if (a.resultJson) localStorage.setItem("ifpc_restore_result", a.resultJson);
                                          const target = a.type === "controle" ? "/controle" : "/bareme";
                                          const href = a.fromDb ? `${target}?history=${a.id}` : target;
                                          router.push(href);
                                        };
                                        return (
                                          <button
                                            key={a.id}
                                            onClick={handleClick}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors group text-left"
                                          >
                                            <span className={`w-0.5 h-7 rounded-full shrink-0 ${sub.bar}`} />
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-semibold text-gray-800 truncate">{meta.title}</p>
                                              <p className="text-[10px] text-gray-400">
                                                {new Date(a.date).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short" })}
                                                {meta.procede && <span className="ml-1">&middot; {meta.procede}</span>}
                                              </p>
                                            </div>
                                            {badge && a.statut && (
                                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.bg} ${badge.text}`}>
                                                {t(`home.statut.${a.statut}`)}
                                              </span>
                                            )}
                                            <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-brand-primary transition-colors shrink-0" />
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {items.length > PREVIEW_COUNT && (
                                      <Link
                                        href="/historique"
                                        className="w-full block py-2 text-center text-[10px] font-semibold text-gray-400 hover:text-brand-primary transition-colors border-t border-gray-50"
                                      >
                                        {t("home.viewAll")} →
                                      </Link>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>
      </div>
    </div>
  );
}
