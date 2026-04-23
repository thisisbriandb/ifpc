"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Globe, Loader2, Check, AlertCircle, Mail } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { updateProfile, changePassword } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Feedback toast ───────────────────────────────────────────────────────

function Toast({ msg }: { msg: { type: "success" | "error"; text: string } }) {
  const Icon = msg.type === "success" ? Check : AlertCircle;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px] leading-snug ${
      msg.type === "success"
        ? "bg-brand-primary/5 text-brand-primary border border-brand-primary/10"
        : "bg-red-50 text-red-700 border border-red-100"
    }`}>
      <Icon className="w-4 h-4 shrink-0" />
      {msg.text}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const router = useRouter();
  const { user, isLoading, checkAuth, setUser } = useAuthStore();
  const { locale, setLocale, t } = useI18n();

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const updated = await updateProfile({ firstName, lastName });
      setUser(updated);
      setProfileMsg({ type: "success", text: t("profile.profileUpdated") });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.response?.data?.error || t("common.error") });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: t("profile.passwordTooShort") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: t("profile.passwordMismatch") });
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: "success", text: t("profile.passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err?.response?.data?.error || t("common.error") });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gray">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const roleName = t(`roles.${user.role}`) !== `roles.${user.role}` ? t(`roles.${user.role}`) : user.role;
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  const ROLE_BADGE: Record<string, string> = {
    ADMIN:   "bg-red-500/8 text-red-600 border-red-500/15",
    EXPERT:  "bg-brand-accent/8 text-brand-accent border-brand-accent/15",
    USER:    "bg-brand-primary/8 text-brand-primary border-brand-primary/15",
    PENDING: "bg-gray-100 text-gray-500 border-gray-200",
  };

  const inputCls = "w-full px-3 py-2.5 border border-black/[0.06] rounded-lg text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/5 transition-colors";
  const inputAccentCls = "w-full px-3 py-2.5 border border-black/[0.06] rounded-lg text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/5 transition-colors";

  return (
    <div className="min-h-screen bg-brand-gray">
      <div className="max-w-lg mx-auto px-4 sm:px-5 py-6 sm:py-8 space-y-6">

        {/* ── Avatar header ── */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
            <span className="text-base sm:text-lg font-bold text-brand-primary">{initials}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-brand-text truncate">
              {user.firstName} {user.lastName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-400" />
                <span className="text-[11px] sm:text-xs text-gray-400 truncate max-w-[150px]">{user.email}</span>
              </div>
              <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_BADGE[user.role] || ROLE_BADGE.USER}`}>
                {roleName}
              </span>
            </div>
          </div>
        </div>

        {/* ── Personal info ── */}
        <form onSubmit={handleProfileSubmit} className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
          <div className="px-5 py-6 space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("profile.personalInfo")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">{t("profile.firstName")}</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                  className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">{t("profile.lastName")}</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                  className={inputCls} />
              </div>
            </div>

            {profileMsg && <Toast msg={profileMsg} />}
          </div>
          <div className="px-5 py-3 bg-gray-50/60 border-t border-black/[0.04] flex justify-end">
            <button type="submit" disabled={profileSaving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50">
              {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("profile.updateProfile")}
            </button>
          </div>
        </form>

        {/* ── Change password ── */}
        <form onSubmit={handlePasswordSubmit} className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-brand-accent" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("profile.changePassword")}</p>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">{t("profile.currentPassword")}</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                className={inputAccentCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">{t("profile.newPassword")}</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                  className={inputAccentCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">{t("profile.confirmPassword")}</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                  className={inputAccentCls} />
              </div>
            </div>

            {passwordMsg && <Toast msg={passwordMsg} />}
          </div>
          <div className="px-5 py-3 bg-gray-50/60 border-t border-black/[0.04] flex justify-end">
            <button type="submit" disabled={passwordSaving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white text-xs font-bold rounded-lg hover:bg-brand-accent/90 transition-colors disabled:opacity-50">
              {passwordSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("profile.changePassword")}
            </button>
          </div>
        </form>

        {/* ── Preferences ── */}
        <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
          <div className="px-5 py-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("profile.preferences")}</p>
            </div>
            <label className="text-[11px] font-semibold text-gray-500 mb-2 block">{t("profile.language")}</label>
            <div className="flex gap-2">
              {([["fr", "Français"], ["en", "English"]] as const).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLocale(code)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    locale === code
                      ? "border-brand-primary/20 bg-brand-primary/5 text-brand-primary shadow-sm"
                      : "border-black/[0.06] bg-white text-gray-400 hover:border-gray-200 hover:text-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
