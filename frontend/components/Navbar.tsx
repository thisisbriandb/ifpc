"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FlaskConical, BarChart3, Home, LogOut, Shield, User,
  ChevronRight, Thermometer, Palette, Container, Clock,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useSidebar } from "@/lib/sidebar-context";
import { useI18n } from "@/lib/i18n";

interface NavGroup {
  key: string;
  label: string;
  icon: any;
  children: { href: string; label: string }[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, checkAuth, logout } = useAuthStore();
  const { collapsed, setCollapsed } = useSidebar();
  const { t } = useI18n();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const handleLogout = () => { logout(); router.push("/login"); };

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const navGroups: NavGroup[] = [
    {
      key: "pasteurisation",
      label: t("nav.pasteurisation"),
      icon: Thermometer,
      children: [
        { href: "/controle", label: t("nav.calculVP") },
        { href: "/bareme", label: t("nav.aideBareme") },
      ],
    },
    {
      key: "colorimetrie",
      label: t("nav.colorimetrie"),
      icon: Palette,
      children: [
        { href: "/colorimetrie/assemblage", label: t("colori.title") },
      ],
    },
    {
      key: "cuves",
      label: t("nav.gestionCuves"),
      icon: Container,
      children: [
        { href: "/cuves", label: t("nav.suiviCuves") },
        { href: "/cuves/assemblage", label: t("nav.assemblage") },
      ],
    },
  ];

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
      <Link href="/" className="flex items-center gap-2.5 px-2.5 h-14 shrink-0 border-b border-gray-50">
        <Image src="/assets/logo.png" alt="IFPC" width={34} height={34} className="shrink-0" />
        {!collapsed && (
          <span className="text-[9px] text-gray-400 font-medium truncate leading-tight">{t("nav.subTitle")}</span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* Home */}
        <div className="px-2 mb-1">
          <Link
            href="/"
            title={collapsed ? t("nav.home") : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
              collapsed ? "justify-center" : ""
            } ${
              pathname === "/"
                ? "text-brand-primary font-semibold"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <Home className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{t("nav.home")}</span>}
          </Link>
        </div>

        {/* Groups */}
        {navGroups.map((group) => {
          // Admin-only groups filtered elsewhere if needed
          const GroupIcon = group.icon;
          const hasActiveChild = group.children.some((c) => pathname.startsWith(c.href));
          const isOpen = openGroups[group.key] ?? hasActiveChild;

          return (
            <div key={group.key} className="px-2 mt-1">
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
                    onClick={() => toggleGroup(group.key)}
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

        {/* Historique — cross-module, after features */}
        <div className="px-2 mt-2 pt-2 border-t border-gray-100">
          <Link
            href="/historique"
            title={collapsed ? t("nav.historique") : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
              collapsed ? "justify-center" : ""
            } ${
              pathname === "/historique"
                ? "text-brand-primary font-semibold"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <Clock className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{t("nav.historique")}</span>}
          </Link>
        </div>

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
              {!collapsed && <span>{t("nav.admin")}</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-gray-50 shrink-0">
        {!isLoading && (
          user ? (
            collapsed ? (
              <div className="flex flex-col items-center gap-1.5">
                <Link href="/profil" title={t("nav.profile")} className="p-2 text-gray-400 hover:text-brand-primary rounded-lg transition-colors">
                  <User className="w-4 h-4" />
                </Link>
                <button onClick={handleLogout} title={t("nav.logout")} className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Link href="/profil" className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-700 truncate group-hover:text-brand-primary transition-colors">{user.firstName} {user.lastName}</p>
                  </div>
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-gray-400 hover:text-red-500 hover:bg-red-50/50 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                  {t("nav.logout")}
                </button>
              </div>
            )
          ) : (
            <Link
              href="/login"
              title={collapsed ? t("nav.loginTitle") : undefined}
              className={`flex items-center justify-center gap-2 w-full text-[12px] font-semibold py-2 rounded-lg transition-colors ${
                collapsed
                  ? "text-gray-400 hover:text-brand-primary"
                  : "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
              }`}
            >
              {collapsed ? <User className="w-4 h-4" /> : t("nav.login")}
            </Link>
          )
        )}
      </div>
    </aside>
  );
}
