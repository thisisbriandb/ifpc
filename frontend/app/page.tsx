"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { ArrowRight, Clock, Trash2 } from "lucide-react";
import { getHistory, deleteAnalysis, type HistoryEntry } from "@/lib/api";

interface RecentActivity {
  id: string;
  date: string;
  type: "controle" | "bareme";
  label: string;
  statut?: string;
  vp?: number;
  vpCible?: number;
  fromDb?: boolean;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  conforme:    { bg: "bg-green-50", text: "text-green-700", label: "Conforme" },
  vigilance:   { bg: "bg-orange-50", text: "text-orange-700", label: "Vigilance" },
  insuffisant: { bg: "bg-red-50", text: "text-red-700", label: "Insuffisant" },
};

interface SubModule {
  href: string;
  label: string;
  description: string;
  tag?: string;
}

interface ModuleSection {
  title: string;
  description: string;
  borderColor: string;
  adminOnly?: boolean;
  items: SubModule[];
}

const modules: ModuleSection[] = [
  {
    title: "Pasteurisation",
    description: "Outils de contrôle et d'aide à la pasteurisation des produits cidricoles",
    borderColor: "border-l-brand-primary",
    items: [
      {
        href: "/controle",
        label: "Calcul de la VP",
        description: "Importez ou saisissez un profil thermique pour évaluer la valeur pasteurisatrice et vérifier la conformité du traitement.",
        tag: "Analyse",
      },
      {
        href: "/bareme",
        label: "Aide au barème",
        description: "Obtenez un couple température / durée adapté à votre produit et à votre procédé de pasteurisation.",
        tag: "Simulation",
      },
    ],
  },
  {
    title: "Administration",
    description: "Gestion de la plateforme",
    borderColor: "border-l-red-400",
    adminOnly: true,
    items: [
      {
        href: "/admin",
        label: "Panneau d'administration",
        description: "Gérez les utilisateurs, validez les inscriptions en attente et configurez les paramètres produits.",
      },
    ],
  },
];

export default function Home() {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivities() {
      // Tenter de charger depuis l'API backend (persistant en BDD)
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
        } catch {
          // API indisponible, fallback localStorage
        }
      }
      // Fallback : localStorage
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
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-10">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Welcome */}
        <header>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}{user ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Plateforme d&apos;aide à la décision · Filière cidricole
          </p>
        </header>

        {/* Modules */}
        <div className="space-y-8">
          {modules
            .filter((mod) => !mod.adminOnly || user?.role === "ADMIN")
            .map((mod) => (
              <section key={mod.title}>
                <div className="mb-3">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{mod.title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{mod.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mod.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group bg-white rounded-xl border border-gray-200 border-l-4 ${mod.borderColor} p-5 hover:shadow-md hover:border-gray-300 transition-all flex flex-col justify-between`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-gray-900">{item.label}</p>
                          {item.tag && (
                            <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {item.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-4 text-sm font-semibold text-brand-primary group-hover:gap-2.5 transition-all">
                        Accéder
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>

        {/* Recent Activities */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Activités récentes</h2>
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
                Effacer
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 text-center">
              <p className="font-medium text-gray-400">Aucune activité récente</p>
              <p className="text-sm text-gray-300 mt-1">Vos analyses apparaîtront ici.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {activities.map((a) => {
                const badge = a.statut ? STATUS_BADGE[a.statut] : undefined;
                const href = a.fromDb
                  ? `/controle?history=${a.id}`
                  : (a.type === "controle" ? "/controle" : "/bareme");
                return (
                  <Link
                    key={a.id}
                    href={href}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.label}</p>
                        <span className="text-[11px] text-gray-300 font-medium shrink-0">
                          {a.type === "controle" ? "VP" : "Barème"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(a.date).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                        {a.vp !== undefined && a.vp !== null && (
                          <span className="ml-2 font-mono text-gray-500">
                            VP {a.vp.toFixed(1)}{a.vpCible ? ` / ${a.vpCible.toFixed(1)}` : ""} UP
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {badge && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-primary transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
