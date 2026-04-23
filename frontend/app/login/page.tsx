"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { login, register } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();
  const { t } = useI18n();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  // Redirect si déjà connecté
  useEffect(() => {
    if (user) router.replace("/controle");
  }, [user, router]);

  const update = useCallback(
    (field: keyof FormData) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setPendingMessage(null);

    try {
      let response;
      if (isLogin) {
        response = await login({
          email: form.email,
          password: form.password,
        });
      } else {
        response = await register(form);
      }

      // Handle pending registration/login
      if (response?.pending) {
        setPendingMessage(response.message || t("login.defaultError"));
        return;
      }

      await checkAuth();
      router.replace("/controle");
    } catch (err: unknown) {
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.response?.data?.detail ||
        t("login.defaultError");

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-gray">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 bg-brand-primary flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20" />

        <div className="relative z-10 flex items-center gap-3">
          <Image src="/assets/logo.png" alt="IFPC" width={44} height={44} className="rounded-xl" />
          <div>
            <span className="font-bold text-xl text-white block">IFPC</span>
            <span className="text-xs text-white/60">
              Institut Français de Production Cidricole
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-extrabold text-white">
            {t("login.heroTitle")}
          </h1>
          <p className="text-white/70 text-lg max-w-sm">
            {t("login.heroSubtitle")}
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-white/40">
            © IFPC — Institut Français des Productions Cidricoles
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
            {isLogin ? t("login.welcomeBack") : t("login.createAccount")}
          </h2>

          <p className="text-gray-400 mb-8 text-sm">
            {isLogin ? t("login.signInSubtitle") : t("login.registerSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {!isLogin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["firstName", "lastName"] as const).map((field) => (
                  <div key={field} className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      disabled={loading}
                      value={form[field]}
                      onChange={update(field)}
                      placeholder={field === "firstName" ? t("login.firstName") : t("login.lastName")}
                      className="input pl-10"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                required
                disabled={loading}
                type="email"
                value={form.email}
                onChange={update("email")}
                placeholder={t("login.email")}
                className="input pl-10"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                required
                disabled={loading}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={update("password")}
                placeholder={t("login.password")}
                className="input pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            {pendingMessage && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800 text-sm font-medium flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {pendingMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!pendingMessage}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition-all shadow-sm hover:shadow-md"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? t("login.signIn") : t("login.register")}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-400">
            {isLogin ? t("login.noAccount") : t("login.hasAccount")}{" "}
            <button
              onClick={() => {
                setIsLogin((v) => !v);
                setError(null);
                setPendingMessage(null);
              }}
              className="text-brand-primary font-bold hover:underline transition-all"
            >
              {isLogin ? t("login.signUp") : t("login.connect")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}