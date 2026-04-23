"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FlaskConical, BarChart3, Home, LogOut, Shield, User,
  ChevronRight, Thermometer, Palette, Container, Clock, Menu, X
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
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { t } = useI18n();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const handleLogout = () => { logout(); router.push("/login"); };

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const closeMobile = () => setMobileOpen(false);

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
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/assets/logo.png" alt="IFPC" width={30} height={30} />
          <span className="font-bold text-brand-text">IFPC</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-50 transition-opacity"
          onClick={closeMobile}
        />
      )}

      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={`fixed top-0 left-0 h-screen bg-white/95 backdrop-blur-sm border-r border-gray-100 flex flex-col transition-all duration-300 overflow-hidden z-[60]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
          ${collapsed ? "lg:w-[52px]" : "w-64 lg:w-56"}
        `}
      >
        {/* Logo & Close Button (Mobile) */}
        <div className="flex items-center justify-between px-3 h-14 shrink-0 border-b border-gray-50">
          <Link href="/" onClick={closeMobile} className="flex items-center gap-2.5">
            <Image src="/assets/logo.png" alt="IFPC" width={34} height={34} className="shrink-0" />
            {(!collapsed || mobileOpen) && (
              <div className="flex flex-col">
                <span className="font-bold text-sm text-brand-text leading-none">IFPC</span>
                <span className="text-[9px] text-gray-400 font-medium truncate leading-tight mt-0.5">{t("nav.subTitle")}</span>
              </div>
            )}
          </Link>
          <button onClick={closeMobile} className="lg:hidden p-2 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
          {/* Home */}
          <div className="px-2 mb-1">
            <Link
              href="/"
              onClick={closeMobile}
              title={collapsed ? t("nav.home") : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                collapsed && !mobileOpen ? "justify-center" : ""
              } ${
                pathname === "/"
                  ? "text-brand-primary font-semibold bg-brand-primary/5"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Home className="w-[18px] h-[18px] shrink-0" />
              {(!collapsed || mobileOpen) && <span>{t("nav.home")}</span>}
            </Link>
          </div>

          {/* Groups */}
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const hasActiveChild = group.children.some((c) => pathname.startsWith(c.href));
            const isOpen = openGroups[group.key] ?? hasActiveChild;

            return (
              <div key={group.key} className="px-2 mt-1">
                {collapsed && !mobileOpen ? (
                  /* Collapsed desktop: only parent icon */
                  <Link
                    href={group.children[0].href}
                    onClick={closeMobile}
                    title={group.label}
                    className={`flex items-center justify-center py-2 rounded-lg transition-colors ${
                      hasActiveChild
                        ? "text-brand-primary bg-brand-primary/5"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <GroupIcon className="w-[18px] h-[18px]" />
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                        hasActiveChild ? "text-brand-primary bg-brand-primary/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
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
                              onClick={closeMobile}
                              className={`block pl-3 pr-2 py-1.5 text-[12px] transition-colors rounded-r-md ${
                                active
                                  ? "text-brand-primary font-semibold border-l-2 border-brand-primary -ml-px bg-brand-primary/5"
                                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
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

          {/* Historique */}
          <div className="px-2 mt-2 pt-2 border-t border-gray-100">
            <Link
              href="/historique"
              onClick={closeMobile}
              title={collapsed ? t("nav.historique") : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                collapsed && !mobileOpen ? "justify-center" : ""
              } ${
                pathname === "/historique"
                  ? "text-brand-primary font-semibold bg-brand-primary/5"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Clock className="w-[18px] h-[18px] shrink-0" />
              {(!collapsed || mobileOpen) && <span>{t("nav.historique")}</span>}
            </Link>
          </div>

          {/* Admin */}
          {user?.role === "ADMIN" && (
            <div className="px-2 mt-3 pt-2 border-t border-gray-50">
              <Link
                href="/admin"
                onClick={closeMobile}
                title={collapsed ? "Admin" : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                  collapsed && !mobileOpen ? "justify-center" : ""
                } ${
                  pathname === "/admin"
                    ? "text-red-500 font-semibold bg-red-50"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50/50"
                }`}
              >
                <Shield className="w-[18px] h-[18px] shrink-0" />
                {(!collapsed || mobileOpen) && <span>{t("nav.admin")}</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-gray-50 shrink-0">
          {!isLoading && (
            user ? (
              collapsed && !mobileOpen ? (
                <div className="flex flex-col items-center gap-1.5">
                  <Link href="/profil" onClick={closeMobile} title={t("nav.profile")} className="p-2 text-gray-400 hover:text-brand-primary rounded-lg transition-colors">
                    <User className="w-4 h-4" />
                  </Link>
                  <button onClick={handleLogout} title={t("nav.logout")} className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Link href="/profil" onClick={closeMobile} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors group">
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
                onClick={closeMobile}
                title={collapsed ? t("nav.loginTitle") : undefined}
                className={`flex items-center justify-center gap-2 w-full text-[12px] font-semibold py-2 rounded-lg transition-colors ${
                  collapsed && !mobileOpen
                    ? "text-gray-400 hover:text-brand-primary"
                    : "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
                }`}
              >
                {collapsed && !mobileOpen ? <User className="w-4 h-4" /> : t("nav.login")}
              </Link>
            )
          )}
        </div>
      </aside>
    </>
  );
}
