"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowRight, Lock } from "lucide-react";
import { verifyResetToken, resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordChecks = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };

  const isValidPassword =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.number &&
    passwordChecks.special;

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setError("Aucun jeton de réinitialisation fourni.");
      return;
    }

    verifyResetToken(token)
      .then(() => {
        setTokenValid(true);
      })
      .catch((err) => {
        setTokenValid(false);
        setError(
          err.response?.data?.error ||
            "Le jeton de réinitialisation est invalide ou expiré."
        );
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || loading) return;

    setError(null);

    if (!isValidPassword) {
      setError(
        "Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Une erreur s'est produite lors de la réinitialisation."
      );
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-3" />
        <p className="text-sm font-medium">Vérification de votre lien en cours...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Mot de passe réinitialisé !</h3>
        <p className="text-sm text-gray-600 max-w-sm mx-auto">
          Votre mot de passe a été modifié avec succès. Vous pouvez désormais vous connecter à votre compte.
        </p>
        <div className="pt-4">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary/90 transition-all"
          >
            Se connecter à IFPC <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Lien invalide ou expiré</h3>
        <p className="text-sm text-gray-600 max-w-sm mx-auto">
          {error || "Ce lien de réinitialisation n'est plus valide. Veuillez faire une nouvelle demande."}
        </p>
        <div className="pt-4">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary/90 transition-all"
          >
            Refaire une demande sur la page de connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-gray-600">
          Nouveau mot de passe
        </span>
        <span className="relative block">
          <input
            required
            disabled={loading}
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-11 pl-10 pr-11 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
          />
          <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 transition-colors hover:text-gray-600"
            aria-label={showPassword ? "Masquer" : "Afficher"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </span>
      </label>

      {newPassword.length > 0 && (
        <div className="space-y-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
          <p className="font-bold text-gray-500 uppercase tracking-wider text-[9px] mb-1">
            Critères du mot de passe :
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  passwordChecks.length ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}
              >
                {passwordChecks.length ? "✓" : "○"}
              </span>
              <span className={passwordChecks.length ? "text-green-700" : "text-gray-500"}>
                8+ caractères
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  passwordChecks.uppercase ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}
              >
                {passwordChecks.uppercase ? "✓" : "○"}
              </span>
              <span className={passwordChecks.uppercase ? "text-green-700" : "text-gray-500"}>
                Une majuscule
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  passwordChecks.number ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}
              >
                {passwordChecks.number ? "✓" : "○"}
              </span>
              <span className={passwordChecks.number ? "text-green-700" : "text-gray-500"}>
                Un chiffre
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  passwordChecks.special ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}
              >
                {passwordChecks.special ? "✓" : "○"}
              </span>
              <span className={passwordChecks.special ? "text-green-700" : "text-gray-500"}>
                Caractère spécial
              </span>
            </div>
          </div>
        </div>
      )}

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
            className={`w-full h-11 pl-10 pr-4 bg-white border rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-4 ${
              confirmPassword.length > 0
                ? newPassword === confirmPassword
                  ? "border-green-300 focus:border-green-500 focus:ring-green-100"
                  : "border-red-300 focus:border-red-500 focus:ring-red-100"
                : "border-gray-200 focus:border-brand-primary focus:ring-brand-primary/10"
            }`}
          />
          <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </span>
        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <span className="text-[10px] text-red-500 mt-1 block">
            Les mots de passe ne correspondent pas.
          </span>
        )}
      </label>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading || !isValidPassword || newPassword !== confirmPassword}
        className="mt-2 flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Réinitialiser le mot de passe
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex bg-[#fafaf8] text-gray-950">
      <div className="hidden md:flex w-1/2 relative overflow-hidden bg-brand-primary/5">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 via-transparent to-brand-accent/10" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 lg:p-14">
          <div className="flex justify-start relative group">
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
              Plateforme d&apos;Aide à la Décision pour la filière Cidricole
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-gray-600">
              Réinitialisation sécurisée de vos identifiants d&apos;accès.
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur p-8 shadow-sm">
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
              Nouveau mot de passe
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Définissez un mot de passe robuste pour sécuriser votre compte.
            </p>
          </header>

          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
