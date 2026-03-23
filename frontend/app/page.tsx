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
  Thermometer,
  Shield,
  Users,
  Settings,
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

interface Module {
  title: string;
  description: string;
  icon: any;
  color: string;
  colorBg: string;
  colorBorder: string;
  adminOnly?: boolean;
  children: { href: string; label: string; description: string; icon: any }[];
}

const modules: Module[] = [
  {
    title: "Pasteurisation",
    description: "Outils de contrôle et d'aide à la pasteurisation des produits cidricoles",
    icon: Thermometer,
    color: "text-brand-primary",
    colorBg: "bg-brand-primary/10",
    colorBorder: "hover:border-brand-primary/30",
    children: [
      {
        href: "/controle",
        label: "Calcul de la VP",
        description: "Analyser un cycle de pasteurisation et vérifier la conformité",
        icon: FlaskConical,
      },
      {
        href: "/bareme",
        label: "Aide au barème",
        description: "Obtenir un barème température / durée adapté",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "Administration",
    description: "Gestion des utilisateurs, rôles et configuration des produits",
    icon: Shield,
    color: "text-red-600",
    colorBg: "bg-red-50",
    colorBorder: "hover:border-red-200",
    adminOnly: true,
    children: [
      {
        href: "/admin",
        label: "Panneau d'administration",
        description: "Utilisateurs, approbations et paramètres produits",
        icon: Settings,
      },
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
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-10">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <header>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Portail IFPC
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Accédez aux modules de la plateforme d&apos;aide à la décision pour la filière cidricole.
          </p>
        </header>

        {/* Module cards */}
        <div className="space-y-8">
          {modules.filter((mod) => !mod.adminOnly || user?.role === "ADMIN").map((mod) => {
            const ModIcon = mod.icon;
            return (
              <section key={mod.title}>
                {/* Module header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg ${mod.colorBg} flex items-center justify-center`}>
                    <ModIcon className={`w-5 h-5 ${mod.color}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{mod.title}</h2>
                    <p className="text-xs text-gray-400">{mod.description}</p>
                  </div>
                </div>

                {/* Sub-module cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {mod.children.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`group bg-white rounded-2xl border border-gray-200 p-5 ${mod.colorBorder} hover:shadow-md transition-all flex items-start gap-4`}
                      >
                        <div className={`w-11 h-11 rounded-xl ${mod.colorBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                          <ChildIcon className={`w-5 h-5 ${mod.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 group-hover:text-gray-700 transition-colors">{child.label}</p>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{child.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

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
                Effacer l&apos;historique
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
