"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FlaskConical, BarChart3, Home, LogOut, Shield, User,
  ChevronRight, Thermometer, Palette, Container,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useSidebar } from "@/lib/sidebar-context";

interface NavGroup {
  label: string;
  icon: any;
  children: { href: string; label: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Pasteurisation",
    icon: Thermometer,
    children: [
      { href: "/controle", label: "Calcul VP" },
      { href: "/bareme", label: "Aide barème" },
    ],
  },
  {
    label: "Colorimétrie",
    icon: Palette,
    children: [
      { href: "/colorimetrie/mesure", label: "Mesure" },
      { href: "/colorimetrie/analyse", label: "Analyse" },
    ],
  },
  {
    label: "Gestion de cuves",
    icon: Container,
    children: [
      { href: "/cuves", label: "Suivi cuves" },
      { href: "/cuves/assemblage", label: "Assemblage" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, checkAuth, logout } = useAuthStore();
  const { collapsed, setCollapsed } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const handleLogout = () => { logout(); router.push("/login"); };

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  if (pathname === "/login") return null;

  return (
    <aside
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      className={`fixed top-0 left-0 h-screen bg-white/95 backdrop-blur-sm border-r border-gray-100 flex flex-col z-50 transition-all duration-200 overflow-hidden ${
        collapsed ? "w-[52px]" : "w-56"
      }`}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-3.5 h-12 shrink-0 border-b border-gray-50">
        <span className="font-bold text-base text-brand-primary shrink-0">IFPC</span>
        {!collapsed && (
          <span className="text-[9px] text-gray-400 font-medium truncate leading-tight">Filière cidricole</span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* Home */}
        <div className="px-2 mb-1">
          <Link
            href="/"
            title={collapsed ? "Accueil" : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
              collapsed ? "justify-center" : ""
            } ${
              pathname === "/"
                ? "text-brand-primary font-semibold"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <Home className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>Accueil</span>}
          </Link>
        </div>

        {/* Groups */}
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const hasActiveChild = group.children.some((c) => pathname.startsWith(c.href));
          const isOpen = openGroups[group.label] ?? hasActiveChild;

          return (
            <div key={group.label} className="px-2 mt-1">
              {collapsed ? (
                /* Collapsed: only parent icon */
                <Link
                  href={group.children[0].href}
                  title={group.label}
                  className={`flex items-center justify-center py-2 rounded-lg transition-colors ${
                    hasActiveChild
                      ? "text-brand-primary"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <GroupIcon className="w-[18px] h-[18px]" />
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                      hasActiveChild ? "text-brand-primary" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <GroupIcon className="w-[18px] h-[18px]" />
                      {group.label}
                    </span>
                    <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="ml-[30px] mt-0.5 space-y-0.5 border-l border-gray-100">
                      {group.children.map(({ href, label }) => {
                        const active = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={`block pl-3 pr-2 py-1.5 text-[12px] transition-colors rounded-r-md ${
                              active
                                ? "text-brand-primary font-semibold border-l-2 border-brand-primary -ml-px"
                                : "text-gray-400 hover:text-gray-700"
                            }`}
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Admin */}
        {user?.role === "ADMIN" && (
          <div className="px-2 mt-3 pt-2 border-t border-gray-50">
            <Link
              href="/admin"
              title={collapsed ? "Admin" : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                pathname === "/admin"
                  ? "text-red-500 font-semibold"
                  : "text-gray-400 hover:text-red-500"
              }`}
            >
              <Shield className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>Administration</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-gray-50 shrink-0">
        {!isLoading && (
          user ? (
            collapsed ? (
              <button onClick={handleLogout} title="Déconnexion" className="w-full flex justify-center p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2 px-1">
                <div className="w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{user.firstName} {user.lastName}</p>
                </div>
                <button onClick={handleLogout} title="Déconnexion" className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors shrink-0">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          ) : (
            <Link
              href="/login"
              title={collapsed ? "Connexion" : undefined}
              className={`flex items-center justify-center gap-2 w-full text-[12px] font-semibold py-2 rounded-lg transition-colors ${
                collapsed
                  ? "text-gray-400 hover:text-brand-primary"
                  : "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
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
