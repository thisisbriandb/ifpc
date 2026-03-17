"use client";

import { useState } from "react";
import { X, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { login, register } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const checkAuth = useAuthStore((state) => state.checkAuth);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await login({ email: formData.email, password: formData.password });
      } else {
        await register(formData);
      }
      await checkAuth();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isLogin ? "Connexion" : "Créer un compte"}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {isLogin 
            ? "Connectez-vous pour accéder à vos réglages experts." 
            : "Inscrivez-vous pour utiliser les fonctionnalités avancées."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Prénom</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nom</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-500 mt-2">{error}</p>}

          <button disabled={loading} type="submit" className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-6">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isLogin ? "Se connecter" : "S'inscrire"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="font-bold text-brand-primary hover:underline ml-1">
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}
