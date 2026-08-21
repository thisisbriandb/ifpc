"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { login, register, forgotPassword } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";

type FormData = {
  firstName: string;
  lastName: string;
  companyName: string;
  companyRole: string;
  email: string;
  password: string;
};

// Après connexion, le cookie de session vient de changer : c'est le middleware
// qui doit trancher où l'utilisateur a le droit d'aller. Or le routeur client
// de Next garde en cache le résultat des navigations précédentes — dont le
// rebond « /controle → /login » subi avant authentification — et le rejouerait
// sans redemander quoi que ce soit au serveur, laissant l'utilisateur bloqué
// sur le formulaire alors qu'il est authentifié.
// Une navigation complète repart du serveur et vide ce cache.
function allerVersApresConnexion() {
  const params = new URLSearchParams(window.location.search);
  const demande = params.get("redirect");
  // On n'accepte qu'un chemin interne : jamais une URL fournie de l'extérieur.
  const destination =
    demande && demande.startsWith("/") && !demande.startsWith("//")
      ? demande
      : "/controle";
  window.location.assign(destination);
}

export default function LoginPage() {
  const { user, checkAuth } = useAuthStore();
  const { t } = useI18n();

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    companyName: "",
    companyRole: "",
    email: "",
    password: "",
  });

  const passwordChecks = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  };

  // Redirect si déjà connecté
  useEffect(() => {
    if (user) allerVersApresConnexion();
  }, [user]);

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
    setForgotMessage(null);

    if (isForgotPassword) {
      if (!form.email || !form.email.includes("@")) {
        setError("Veuillez saisir une adresse e-mail valide.");
        setLoading(false);
        return;
      }
      try {
        const res = await forgotPassword(form.email);
        setForgotMessage(res.message || "Si un compte existe avec cet e-mail, un lien de réinitialisation vous a été envoyé.");
      } catch (err: any) {
        setError(err.response?.data?.message || "Une erreur est survenue lors de l'envoi de la demande.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isLogin) {
      const isValidPassword = passwordChecks.length && passwordChecks.uppercase && passwordChecks.number && passwordChecks.special;
      if (!isValidPassword) {
        setError("Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.");
        setLoading(false);
        return;
      }
      if (form.password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        setLoading(false);
        return;
      }
    }

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
      allerVersApresConnexion();
      return; // la navigation complète prend la main, inutile de rendre à nouveau
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
    <div className="min-h-screen flex bg-[#fafaf8] text-gray-950">
      <div className="hidden md:flex w-1/2 relative overflow-hidden bg-brand-primary/5">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 via-transparent to-brand-accent/10" />

        {/* Soft premium background blobs */}
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-brand-primary/10 blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-brand-accent/5 blur-3xl animate-pulse" style={{ animationDuration: "12s" }} />

        {/* Subtly animated abstract lines/grid pattern */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Curved abstract stroke line for a fluid design */}
        <div className="absolute inset-0 opacity-[0.06] flex items-center justify-center">
          <svg className="w-full h-full text-brand-primary" fill="none" viewBox="0 0 800 800">
            <path
              d="M-100,700 C150,600 250,300 450,400 C650,500 700,200 900,100"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="8 8"
            />
            <path
              d="M-50,750 C200,650 300,350 500,450 C700,550 750,250 950,150"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        </div>

        <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 lg:p-14">
          <div className="flex justify-start relative group">
            {/* Glow behind the logo */}
            <div className="absolute -inset-4 rounded-full bg-brand-primary/15 blur-2xl opacity-75 transition-all duration-700 group-hover:bg-brand-primary/25 group-hover:scale-110" />
            <Image
              src="/assets/log.svg"
              alt="IFPC"
              width={360}
              height={360}
              priority
              className="relative z-10 h-56 w-56 lg:h-72 lg:w-72 object-contain"
            />
          </div>

          <div className="max-w-xl pb-2">
            <h1 className="text-2xl lg:text-2xl font-semibold tracking-tight leading-tight text-gray-950">
              {"Plateforme d'Aide à la Décision pour la filière Cidricole"}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-gray-600">
              Optimisez vos processus grâce à des outils avancés
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur p-8 shadow-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={isForgotPassword ? "forgot" : isLogin ? "login" : "register"}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <header className="mb-8 text-center md:text-left">
                <Image
                  src="/assets/log.svg"
                  alt="IFPC"
                  width={180}
                  height={180}
                  priority
                  className="mx-auto mb-6 h-36 w-36 object-contain md:hidden"
                />
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">
                  PADOC
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-gray-950">
                  {isForgotPassword
                    ? "Mot de passe oublié"
                    : isLogin
                    ? t("login.welcomeBack")
                    : t("login.createAccount")}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {isForgotPassword
                    ? "Entrez votre adresse e-mail ci-dessous pour recevoir un lien de réinitialisation."
                    : isLogin
                    ? "Connectez-vous pour accéder à votre tableau de bord."
                    : t("login.registerSubtitle")}
                </p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isForgotPassword && !isLogin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(["firstName", "lastName"] as const).map((field) => (
                      <label key={field} className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                          {field === "firstName" ? t("login.firstName") : t("login.lastName")}
                        </span>
                        <input
                          required
                          disabled={loading}
                          value={form[field]}
                          onChange={update(field)}
                          placeholder={
                            field === "firstName"
                              ? t("login.firstName")
                              : t("login.lastName")
                          }
                          className="w-full h-11 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                        />
                      </label>
                    ))}
                  </div>
                )}

                {!isForgotPassword && !isLogin && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                        Nom de l&apos;entreprise
                      </span>
                      <input
                        required
                        disabled={loading}
                        value={form.companyName}
                        onChange={update("companyName")}
                        placeholder="Votre entreprise"
                        className="w-full h-11 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                        Rôle dans l&apos;entreprise
                      </span>
                      <input
                        required
                        disabled={loading}
                        value={form.companyRole}
                        onChange={update("companyRole")}
                        placeholder="Votre rôle"
                        className="w-full h-11 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                      />
                    </label>
                  </>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Adresse e-mail
                  </span>
                  <input
                    required
                    disabled={loading}
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder={t("login.email")}
                    className="w-full h-11 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                  />
                </label>

                {!isForgotPassword && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                      {t("login.password")}
                    </span>
                    <span className="relative block">
                      <input
                        required
                        disabled={loading}
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={update("password")}
                        placeholder="••••••••"
                        className="w-full h-11 pl-4 pr-11 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 transition-colors hover:text-gray-600"
                        aria-label={
                          showPassword
                            ? "Masquer le mot de passe"
                            : "Afficher le mot de passe"
                        }
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </span>
                  </label>
                )}

                {!isForgotPassword && !isLogin && form.password.length > 0 && (
                  <div className="space-y-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                    <p className="font-bold text-gray-500 uppercase tracking-wider text-[9px] mb-1">Critères du mot de passe :</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${passwordChecks.length ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {passwordChecks.length ? "✓" : "○"}
                        </span>
                        <span className={passwordChecks.length ? "text-green-700" : "text-gray-500"}>8+ caractères</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${passwordChecks.uppercase ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {passwordChecks.uppercase ? "✓" : "○"}
                        </span>
                        <span className={passwordChecks.uppercase ? "text-green-700" : "text-gray-500"}>Une majuscule</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${passwordChecks.number ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {passwordChecks.number ? "✓" : "○"}
                        </span>
                        <span className={passwordChecks.number ? "text-green-700" : "text-gray-500"}>Un chiffre</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${passwordChecks.special ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {passwordChecks.special ? "✓" : "○"}
                        </span>
                        <span className={passwordChecks.special ? "text-green-700" : "text-gray-500"}>Caractère spécial</span>
                      </div>
                    </div>
                  </div>
                )}

                {!isForgotPassword && !isLogin && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                      Confirmer le mot de passe
                    </span>
                    <span className="relative block">
                      <input
                        required
                        disabled={loading}
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full h-11 px-4 bg-white border rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-4 ${
                          confirmPassword.length > 0
                            ? form.password === confirmPassword
                              ? "border-green-300 focus:border-green-500 focus:ring-green-100"
                              : "border-red-300 focus:border-red-500 focus:ring-red-100"
                            : "border-gray-200 focus:border-brand-primary focus:ring-brand-primary/10"
                        }`}
                      />
                    </span>
                    {confirmPassword.length > 0 && form.password !== confirmPassword && (
                      <span className="text-[10px] text-red-500 mt-1 block">Les mots de passe ne correspondent pas.</span>
                    )}
                  </label>
                )}

                {isLogin && !isForgotPassword && (
                  <div className="-mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setPendingMessage(null);
                        setForgotMessage(null);
                        setIsForgotPassword(true);
                      }}
                      className="text-xs font-semibold text-brand-primary transition-colors hover:text-brand-primary/80 hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="text-red-600 text-sm">{error}</div>
                )}

                {forgotMessage && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {forgotMessage}
                  </div>
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
                  className="mt-2 flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {isForgotPassword
                        ? "Envoyer le lien"
                        : isLogin
                        ? t("login.signIn")
                        : t("login.register")}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </AnimatePresence>

          <p className="mt-8 text-center text-sm text-gray-400">
            {isForgotPassword ? (
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setError(null);
                  setForgotMessage(null);
                  setPendingMessage(null);
                }}
                className="font-semibold text-brand-primary transition-all hover:underline"
              >
                ← Retour à la connexion
              </button>
            ) : (
              <>
                {isLogin ? t("login.noAccount") : t("login.hasAccount")}{" "}
                <button
                  onClick={() => {
                    setIsLogin((v) => !v);
                    setIsForgotPassword(false);
                    setError(null);
                    setPendingMessage(null);
                    setForgotMessage(null);
                    setConfirmPassword("");
                    setForm((prev) => ({ ...prev, password: "" }));
                  }}
                  className="font-semibold text-brand-primary transition-all hover:underline"
                >
                  {isLogin ? t("login.signUp") : t("login.connect")}
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
