"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Globe, Loader2, Check, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { updateProfile, changePassword } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
      <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const roleName = t(`roles.${user.role}`) !== `roles.${user.role}` ? t(`roles.${user.role}`) : user.role;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-bold text-gray-900">{t("profile.title")}</h1>
      </div>

      <div className="max-w-xl mx-auto p-5 space-y-5">

        {/* Personal info */}
        <form onSubmit={handleProfileSubmit} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-gray-900">{t("profile.personalInfo")}</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{t("profile.firstName")}</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{t("profile.lastName")}</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{t("profile.email")}</label>
              <input type="email" value={user.email} disabled
                className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{t("profile.role")}</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600 font-medium">
                {roleName}
              </div>
            </div>

            {profileMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                profileMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                <Check className="w-4 h-4 shrink-0" />
                {profileMsg.text}
              </div>
            )}

            <button type="submit" disabled={profileSaving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50">
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("profile.updateProfile")}
            </button>
          </div>
        </form>

        {/* Change password */}
        <form onSubmit={handlePasswordSubmit} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-accent" />
            <h2 className="text-sm font-bold text-gray-900">{t("profile.changePassword")}</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{t("profile.currentPassword")}</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{t("profile.newPassword")}</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">{t("profile.confirmPassword")}</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10" />
              </div>
            </div>

            {passwordMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                passwordMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                <Check className="w-4 h-4 shrink-0" />
                {passwordMsg.text}
              </div>
            )}

            <button type="submit" disabled={passwordSaving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white text-sm font-bold rounded-lg hover:bg-brand-accent/90 transition-colors disabled:opacity-50">
              {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("profile.changePassword")}
            </button>
          </div>
        </form>

        {/* Language preference */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-gray-900">{t("profile.preferences")}</h2>
          </div>
          <div className="p-5">
            <label className="text-[11px] font-semibold text-gray-500 mb-2 block">{t("profile.language")}</label>
            <div className="flex gap-2">
              {([["fr", "Français", "🇫🇷"], ["en", "English", "🇬🇧"]] as const).map(([code, label, flag]) => (
                <button
                  key={code}
                  onClick={() => setLocale(code)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                    locale === code
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-base">{flag}</span>
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
