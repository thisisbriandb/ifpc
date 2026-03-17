"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import {
  FlaskConical,
  BarChart3,
  Clock,
  ChevronRight,
  Activity,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface RecentActivity {
  id: string;
  date: string;
  type: "controle" | "bareme";
  label: string;
  statut?: string;
  vp?: number;
  vpCible?: number;
}

const STATUS_META: Record<string, { icon: any; badge: string; label: string }> = {
  conforme: { icon: CheckCircle2, badge: "bg-green-100 text-green-700", label: "Conforme" },
  vigilance: { icon: AlertTriangle, badge: "bg-orange-100 text-orange-700", label: "Vigilance" },
  insuffisant: { icon: AlertCircle, badge: "bg-red-100 text-red-700", label: "Insuffisant" },
};

export default function Home() {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  // Lire les activités récentes depuis le localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ifpc_recent_activities");
      if (stored) setActivities(JSON.parse(stored));
    } catch {
      setActivities([]);
    }
  }, []);

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
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {greeting()} 👋
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Tableau de bord IFPC · Pasteurisation &amp; Colorimétrie
          </p>
        </header>

        {/* Quick Actions */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Actions rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/controle"
              className="group bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-brand-primary/30 transition-all flex items-center gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0 group-hover:bg-brand-primary/20 transition-colors">
                <FlaskConical className="w-6 h-6 text-brand-primary" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">Contrôle de lot</p>
                <p className="text-xs text-gray-400 mt-0.5">Analyser un cycle de pasteurisation</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-primary transition-colors" />
            </Link>

            <Link
              href="/bareme"
              className="group bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-brand-accent/30 transition-all flex items-center gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center shrink-0 group-hover:bg-brand-accent/20 transition-colors">
                <BarChart3 className="w-6 h-6 text-brand-accent" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">Aide au barème</p>
                <p className="text-xs text-gray-400 mt-0.5">Obtenir un barème température/durée</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-accent transition-colors" />
            </Link>
          </div>
        </section>

        {/* Recent Activities */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Activités récentes</h2>
            {activities.length > 0 && (
              <button
                onClick={() => {
                  localStorage.removeItem("ifpc_recent_activities");
                  setActivities([]);
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Effacer l'historique
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">Aucune activité récente</p>
              <p className="text-sm text-gray-300 mt-1">
                Vos analyses de pasteurisation apparaîtront ici.
              </p>
              <Link
                href="/controle"
                className="mt-6 inline-flex items-center gap-2 bg-brand-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-brand-primary/90 transition-colors"
              >
                <FlaskConical className="w-4 h-4" />
                Lancer une analyse
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-50">
              {activities.map((a) => {
                const meta = a.statut ? STATUS_META[a.statut] : undefined;
                const StatusIcon = meta?.icon;
                return (
                  <Link
                    key={a.id}
                    href={a.type === "controle" ? "/controle" : "/bareme"}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.type === "controle" ? "bg-brand-primary/10" : "bg-brand-accent/10"}`}>
                      {a.type === "controle"
                        ? <FlaskConical className="w-4 h-4 text-brand-primary" />
                        : <BarChart3 className="w-4 h-4 text-brand-accent" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{a.label}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(a.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        {a.vp !== undefined && (
                          <span className="ml-2 font-mono">· VP {a.vp.toFixed(1)} UP</span>
                        )}
                      </p>
                    </div>

                    {meta && StatusIcon && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0 ${meta.badge}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                    )}

                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
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
