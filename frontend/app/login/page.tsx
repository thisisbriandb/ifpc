"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  FlaskConical,
} from "lucide-react";
import { login, register } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    try {
      if (isLogin) {
        await login({
          email: form.email,
          password: form.password,
        });
      } else {
        await register(form);
      }

      await checkAuth();
      router.replace("/controle");
    } catch (err: unknown) {
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.response?.data?.detail ||
        "Une erreur est survenue. Réessayez.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 bg-brand-primary flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-xl text-white block">IFPC</span>
            <span className="text-xs text-white/60">
              Institut Français de Production Cidricole
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-extrabold text-white">
            Plateforme d'aide à la prise de decision
          </h1>
          <p className="text-white/70 text-lg max-w-sm">
            Optimisez vos processus grâce à des outils avancés          </p>
        </div>

        <div className="relative z-10 flex gap-8">
          {[
            { val: "99.9%", label: "Précision" },
            { val: "<1s", label: "Temps réel" },
            { val: "3", label: "Accès" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-2xl font-bold text-white">{item.val}</p>
              <p className="text-sm text-white/50">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
            {isLogin ? "Bon retour" : "Créer un compte"}
          </h2>

          <p className="text-gray-400 mb-8 text-sm">
            {isLogin
              ? "Connectez-vous à votre espace."
              : "Commencez dès maintenant."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                {(["firstName", "lastName"] as const).map((field) => (
                  <input
                    key={field}
                    required
                    disabled={loading}
                    value={form[field]}
                    onChange={update(field)}
                    placeholder={field === "firstName" ? "Prénom" : "Nom"}
                    className="input"
                  />
                ))}
              </div>
            )}

            <input
              required
              disabled={loading}
              type="email"
              value={form.email}
              onChange={update("email")}
              placeholder="Email"
              className="input"
            />

            <div className="relative">
              <input
                required
                disabled={loading}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={update("password")}
                placeholder="Mot de passe"
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary text-white py-3 rounded-xl flex justify-center items-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {isLogin ? "Connexion" : "Créer un compte"}
                  <ArrowRight />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin((v) => !v);
                setError(null);
              }}
              className="text-brand-primary font-semibold"
            >
              {isLogin ? "Créer un compte" : "Se connecter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}