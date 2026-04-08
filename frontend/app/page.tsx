"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  ArrowRight, Clock, Trash2,
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
  produit?: string;
  procede?: string;
  statut?: string;
  vp?: number;
  vpCible?: number;
  fromDb?: boolean;
  resultJson?: string;
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  conforme:    { bg: "bg-green-50",   text: "text-green-700"  },
  vigilance:   { bg: "bg-orange-50",  text: "text-orange-700" },
  insuffisant: { bg: "bg-red-50",     text: "text-red-700"    },
};

const MODULE_META: Record<string, { icon: any; iconColor: string; pill: string }> = {
  controle: { icon: FlaskConical, iconColor: "text-brand-primary", pill: "bg-brand-primary/10 text-brand-primary" },
  bareme:   { icon: BarChart3,    iconColor: "text-brand-accent",  pill: "bg-brand-accent/10 text-brand-accent"  },
};

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
  const ARC_RADIUS = 90;
  const getArcPosition = (index: number, total: number) => {
    // Spread evenly across 180° arc (π), centered below
    const startAngle = Math.PI * 0.15;
    const endAngle   = Math.PI * 0.85;
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
      style={{ width: 200, height: 100 }}
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
      <span className="mt-2 text-xs font-bold text-gray-600 tracking-wide">{mod.label}</span>

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
              <span className="mt-1 text-[10px] font-semibold text-gray-500 whitespace-nowrap">{sub.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Decorative arc line (SVG) */}
      <svg
        className={`absolute top-12 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${open ? "opacity-20" : "opacity-0"}`}
        width="200" height="110" viewBox="-100 -10 200 110"
        fill="none"
      >
        <path
          d={`M ${ARC_RADIUS * Math.cos(Math.PI * 0.15)} ${ARC_RADIUS * Math.sin(Math.PI * 0.15)} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 0 ${ARC_RADIUS * Math.cos(Math.PI * 0.85)} ${ARC_RADIUS * Math.sin(Math.PI * 0.85)}`}
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
  const { t } = useI18n();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
              statut: e.statut,
              vp: e.vp,
              vpCible: e.vpCible,
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-10">
      <div className="max-w-4xl mx-auto space-y-12">

        {/* Welcome */}
        <header className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}{user ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{t("home.subtitle")}</p>
        </header>

        {/* Module arcs */}
        <div className="flex justify-center gap-12 flex-wrap pt-2 overflow-visible relative z-10">
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
              <button
                onClick={() => {
                  localStorage.removeItem("ifpc_recent_activities");
                  setActivities([]);
                }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                {t("home.clear")}
              </button>
            )}
          </div>

          {(() => {
            // Build a map of type → sorted entries (date desc)
            const grouped = activities.reduce<Record<string, RecentActivity[]>>((acc, a) => {
              if (!acc[a.type]) acc[a.type] = [];
              acc[a.type].push(a);
              return acc;
            }, {});
            Object.values(grouped).forEach(items =>
              items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            );

            return (
              <div className="space-y-4">
                {Object.entries(MODULE_META).map(([type, meta]) => {
                  const items = grouped[type] ?? [];
                  const GroupIcon = meta.icon;
                  return (
                    <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Group header */}
                      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${meta.pill}`}>
                          <GroupIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-gray-700 tracking-wide">{t(`home.moduleMeta.${type}`)}</span>
                        <span className="text-[10px] text-gray-400 font-medium ml-1">— {t("home.recentFirst")}</span>
                        <span className="ml-auto text-[11px] font-semibold text-gray-400">{items.length} {items.length > 1 ? t("home.entries") : t("home.entry")}</span>
                      </div>

                      {/* Entries */}
                      {items.length === 0 ? (
                        <div className="px-5 py-6 text-center text-xs text-gray-300 italic">{t("home.noEntries")}</div>
                      ) : (() => {
                        const isExpanded = expandedGroups[type] ?? false;
                        const visible = isExpanded ? items : items.slice(0, PREVIEW_COUNT);
                        const hiddenCount = items.length - PREVIEW_COUNT;
                        return (
                          <>
                            <div className="divide-y divide-gray-50">
                              {visible.map((a) => {
                                const badge = a.statut ? STATUS_BADGE[a.statut] : undefined;
                                const vpPct = a.vp != null && a.vpCible ? Math.min((a.vp / a.vpCible) * 100, 100) : null;
                                const handleClick = () => {
                                  if (a.resultJson) {
                                    localStorage.setItem("ifpc_restore_result", a.resultJson);
                                  }
                                  const target = a.type === "controle" ? "/controle" : "/bareme";
                                  const href = a.fromDb ? `${target}?history=${a.id}` : target;
                                  router.push(href);
                                };
                                return (
                                  <button
                                    key={a.id}
                                    onClick={handleClick}
                                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors group text-left"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{a.label}</p>
                                        {a.produit && a.produit !== a.label && (
                                          <span className="text-[11px] font-medium text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full shrink-0">
                                            {a.produit}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(a.date).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                                        {a.procede && (
                                          <span className="ml-1.5 text-gray-500">&middot; {a.procede}</span>
                                        )}
                                      </p>
                                      {vpPct !== null && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                                            <div
                                              className={`h-full rounded-full transition-all ${
                                                vpPct >= 100 ? "bg-green-400" : vpPct >= 70 ? "bg-orange-400" : "bg-red-400"
                                              }`}
                                              style={{ width: `${vpPct}%` }}
                                            />
                                          </div>
                                          <span className="text-[11px] font-mono font-semibold text-gray-600">
                                            {a.vp!.toFixed(1)}{a.vpCible ? ` / ${a.vpCible.toFixed(1)}` : ""} UP
                                          </span>
                                        </div>
                                      )}
                                      {a.vp != null && vpPct === null && (
                                        <span className="text-[11px] font-mono text-gray-500 mt-0.5 block">
                                          VP {a.vp.toFixed(1)} UP
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-4">
                                      {badge && a.statut && (
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                                          {t(`home.statut.${a.statut}`)}
                                        </span>
                                      )}
                                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-primary transition-colors" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Expand / collapse toggle */}
                            {items.length > PREVIEW_COUNT && (
                              <button
                                onClick={() => setExpandedGroups(prev => ({ ...prev, [type]: !isExpanded }))}
                                className="w-full py-2.5 text-[11px] font-semibold text-gray-400 hover:text-brand-primary hover:bg-gray-50/60 transition-colors border-t border-gray-50"
                              >
                                {isExpanded
                                  ? `▲ ${t("home.collapse")}`
                                  : `▼ ${hiddenCount > 1 ? t("home.showMorePlural", { n: hiddenCount }) : t("home.showMore", { n: hiddenCount })}`}
                              </button>
                            )}
                          </>
                        );
                      })()}
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
