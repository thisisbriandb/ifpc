"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { ArrowRight } from "lucide-react";

interface RecentActivity {
  id: string;
  date: string;
  type: "controle" | "bareme";
  label: string;
  statut?: string;
  vp?: number;
  vpCible?: number;
}

const STATUS_LABELS: Record<string, { cls: string; label: string }> = {
  conforme:    { cls: "text-green-600", label: "Conforme" },
  vigilance:   { cls: "text-orange-600", label: "Vigilance" },
  insuffisant: { cls: "text-red-600", label: "Insuffisant" },
};

interface SubModule {
  href: string;
  label: string;
  description: string;
}

interface ModuleSection {
  title: string;
  accent: string;
  adminOnly?: boolean;
  items: SubModule[];
}

const modules: ModuleSection[] = [
  {
    title: "Pasteurisation",
    accent: "brand-primary",
    items: [
      { href: "/controle", label: "Calcul de la VP", description: "Analyser un cycle et vérifier la conformité" },
      { href: "/bareme",   label: "Aide au barème",  description: "Obtenir un barème température / durée" },
    ],
  },
  {
    title: "Administration",
    accent: "red-600",
    adminOnly: true,
    items: [
      { href: "/admin", label: "Gestion", description: "Utilisateurs, approbations et paramètres produits" },
    ],
  },
];

export default function Home() {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ifpc_recent_activities");
      if (stored) setActivities(JSON.parse(stored));
    } catch {
      setActivities([]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <header className="mb-12">
          <h1 className="text-2xl font-bold text-gray-900">Portail IFPC</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Plateforme d&apos;aide à la décision pour la filière cidricole
          </p>
        </header>

        {/* Modules */}
        <div className="space-y-10">
          {modules
            .filter((mod) => !mod.adminOnly || user?.role === "ADMIN")
            .map((mod) => (
              <section key={mod.title}>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  {mod.title}
                </h2>
                <div className="space-y-2">
                  {mod.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-[15px]">{item.label}</p>
                        <p className="text-sm text-gray-400 mt-0.5">{item.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-4" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>

        {/* Recent Activities */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Activités récentes</h2>
            {activities.length > 0 && (
              <button
                onClick={() => {
                  localStorage.removeItem("ifpc_recent_activities");
                  setActivities([]);
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Effacer
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <p className="text-sm text-gray-300 py-6 text-center">
              Aucune activité récente
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {activities.map((a) => {
                const status = a.statut ? STATUS_LABELS[a.statut] : undefined;
                return (
                  <Link
                    key={a.id}
                    href={a.type === "controle" ? "/controle" : "/bareme"}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(a.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        {a.vp !== undefined && (
                          <span className="ml-2 font-mono">· VP {a.vp.toFixed(1)} UP</span>
                        )}
                      </p>
                    </div>
                    {status && (
                      <span className={`text-xs font-semibold shrink-0 ml-4 ${status.cls}`}>
                        {status.label}
                      </span>
                    )}
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
