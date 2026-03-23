"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FlaskConical, BarChart3, Home, LogOut, Shield, ShieldCheck, User,
  ChevronDown, Thermometer, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useSidebar } from "@/lib/sidebar-context";

interface NavGroup {
  label: string;
  icon: any;
  children: { href: string; label: string; icon: any }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Pasteurisation",
    icon: Thermometer,
    children: [
      { href: "/controle", label: "Calcul de la VP", icon: FlaskConical },
      { href: "/bareme", label: "Aide au barème", icon: BarChart3 },
    ],
  },
];

const standaloneLinks = [
  { href: "/", label: "Tableau de bord", icon: Home },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, checkAuth, logout } = useAuthStore();
  const { collapsed, toggle } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Pasteurisation: true });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const roleMeta: Record<string, { label: string; classes: string; icon: any }> = {
    ADMIN:  { label: "Administrateur", classes: "bg-red-100 text-red-700", icon: Shield },
    EXPERT: { label: "Expert",         classes: "bg-orange-100 text-orange-700", icon: ShieldCheck },
    USER:   { label: "Utilisateur",    classes: "bg-gray-100 text-gray-600", icon: User },
  };
  const meta = user ? (roleMeta[user.role] ?? roleMeta.USER) : null;

  if (pathname === "/login") return null;

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-100 flex flex-col z-50 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Header: Logo + Toggle */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
        {!collapsed && (
          <Link href="/" className="min-w-0">
            <span className="font-bold text-lg text-gray-900 leading-none tracking-tight block">IFPC</span>
            <span className="text-[10px] text-gray-400 leading-tight font-medium block">Outils filière cidricole</span>
          </Link>
        )}
        <button
          onClick={toggle}
          className={`p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0 ${collapsed ? "mx-auto" : ""}`}
          title={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-1">
        {/* Standalone links */}
        {standaloneLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "text-gray-500 hover:text-brand-primary hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* Grouped navigation */}
        {navGroups.map((group) => {
          const isOpen = openGroups[group.label] ?? false;
          const GroupIcon = group.icon;
          const hasActiveChild = group.children.some((c) => pathname === c.href);

          if (collapsed) {
            return (
              <div key={group.label} className="space-y-1 mt-3 pt-3 border-t border-gray-100">
                {group.children.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={label}
                      className={`flex items-center justify-center px-3 py-2.5 rounded-xl transition-all ${
                        active
                          ? "bg-brand-primary/10 text-brand-primary"
                          : "text-gray-500 hover:text-brand-primary hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </Link>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={group.label} className="mt-4">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  hasActiveChild ? "text-brand-primary" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <GroupIcon className="w-3.5 h-3.5" />
                  {group.label}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
              </button>
              {isOpen && (
                <div className="mt-1.5 ml-2 space-y-1">
                  {group.children.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm font-medium transition-all border-l-2 ${
                          active
                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                            : "border-transparent text-gray-500 hover:text-brand-primary hover:bg-gray-50"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Admin link */}
        {user?.role === "ADMIN" && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <Link
              href="/admin"
              title={collapsed ? "Administration" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                collapsed ? "justify-center" : ""
              } ${
                pathname === "/admin"
                  ? "bg-red-50 text-red-600"
                  : "text-gray-500 hover:text-red-600 hover:bg-red-50"
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Administration</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* Bottom: User section */}
      <div className="px-2 py-4 border-t border-gray-100">
        {!isLoading && (
          user ? (
            collapsed ? (
              <div className="flex flex-col items-center gap-2">
                {meta && (
                  <div className={`p-1.5 rounded-lg ${meta.classes}`} title={meta.label}>
                    <meta.icon className="w-3.5 h-3.5" />
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  title="Déconnexion"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3 px-1">
                {meta && (
                  <div className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg w-fit ${meta.classes}`}>
                    <meta.icon className="w-3 h-3" />
                    {meta.label}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Déconnexion"
                    className="ml-1 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          ) : (
            <Link
              href="/login"
              title={collapsed ? "Se connecter" : undefined}
              className={`flex items-center justify-center gap-2 w-full bg-brand-primary text-white text-sm font-bold py-2.5 rounded-xl hover:bg-brand-primary/90 transition-all ${
                collapsed ? "px-0" : ""
              }`}
            >
              {collapsed ? <User className="w-4 h-4" /> : "Se connecter"}
            </Link>
          )
        )}
      </div>
    </aside>
  );
}
