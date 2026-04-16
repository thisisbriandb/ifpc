"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { getUsers, updateUserRole } from "@/lib/api";
import {
  Shield, ShieldCheck, Users, Loader2, Search,
  ShieldAlert, CheckCircle2, Lock
} from "lucide-react";

interface UserData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const ROLE_META: Record<string, { label: string; badge: string; icon: any }> = {
  ADMIN: { label: "Admin", badge: "bg-red-100 text-red-700", icon: ShieldAlert },
  EXPERT: { label: "Expert", badge: "bg-orange-100 text-orange-700", icon: ShieldCheck },
  USER: { label: "User", badge: "bg-gray-100 text-gray-500", icon: Users },
};

export default function ExpertPage() {
  const { user, isLoading } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    getUsers()
      .then((data: UserData[]) => {
        // Exclure les admins de la liste éditable
        setUsers(data.filter((u) => u.role !== "ADMIN"));
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev
          .map((u) => (u.id === userId ? { ...u, role: newRole } : u))
          .filter((u) => u.role !== "ADMIN") // retirer si promu admin
      );
    } catch {
      alert("Erreur lors de la mise à jour.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.firstName.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  // == VUE UTILISATEUR : accès limité ===
  if (user?.role === "USER" || !user) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-9 h-9 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Accès Restreint</h2>
          <p className="text-gray-500 leading-relaxed">
            Cette section est réservée aux comptes <span className="font-bold text-orange-600">Expert</span> et{" "}
            <span className="font-bold text-red-600">Admin</span>. Contactez votre administrateur pour obtenir les droits nécessaires.
          </p>
          <div className="mt-8 space-y-3 text-left">
            {["EXPERT", "ADMIN"].map((r) => {
              const m = ROLE_META[r];
              return (
                <div key={r} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${r === "EXPERT" ? "border-orange-100 bg-orange-50/50" : "border-red-100 bg-red-50/50"}`}>
                  <m.icon className={`w-5 h-5 ${r === "EXPERT" ? "text-orange-500" : "text-red-500"}`} />
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{r}</p>
                    <p className="text-xs text-gray-500">
                      {r === "EXPERT" ? "Paramètres avancés : t_ref, z, microorganisme..." : "Gestion complète de la plateforme et des utilisateurs."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // == VUE EXPERT (non admin) : info sur ses droits ===
  if (user?.role === "EXPERT") {
    return (
      <div className="min-h-screen bg-brand-gray p-8">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900">Espace Expert</h1>
                <p className="text-sm text-orange-600 font-medium">Accès avancé activé</p>
              </div>
            </div>
          </header>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Fonctionnalités disponibles avec votre rôle Expert
            </h2>
            <div className="space-y-3">
              {[
                { title: "Paramètre T_ref personnalisé", desc: "Définissez la température de référence pour vos calculs de pasteurisation." },
                { title: "Paramètre Z personnalisé", desc: "Ajustez le coefficient de sensibilité thermique du microorganisme cible." },
                { title: "Sélection du microorganisme", desc: "Choisissez le microorganisme cible parmi la base de données de l'IFPC." },
                { title: "Barèmes avancés", desc: "Accès à la proposition de barème avec paramétrage expert." },
              ].map(({ title, desc }) => (
                <div key={title} className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              Pour activer ces paramètres dans l&apos;interface, activez le <strong>MODE EXPERT</strong> dans le panneau de Configuration du lot sur la page Contrôle.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // == VUE ADMIN : gestion des utilisateurs ===
  return (
    <div className="min-h-screen bg-brand-gray p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">

            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Gestion des Accès</h1>
              <p className="text-sm text-red-600 font-medium">Espace Administration</p>
            </div>
          </div>
          <p className="text-gray-500 mt-1">
            Définissez les rôles des utilisateurs inscrits. Les comptes Admin ne sont pas affichés ici.
          </p>
        </header>

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Rôle actuel</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Modifier le rôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((u) => {
                    const meta = ROLE_META[u.role] ?? ROLE_META.USER;
                    const MetaIcon = meta.icon;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-sm uppercase shrink-0">
                              {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                            </div>
                            <span className="font-semibold text-gray-900">{u.firstName} {u.lastName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${meta.badge}`}>
                            <MetaIcon className="w-3.5 h-3.5" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {updatingId === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-3 py-2 ml-auto block outline-none hover:border-gray-300 cursor-pointer transition-colors focus:ring-2 focus:ring-red-100 focus:border-red-300"
                            >
                              <option value="USER">USER</option>
                              <option value="EXPERT">EXPERT</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Les modifications sont appliquées immédiatement. L&apos;utilisateur devra se reconnecter pour que son nouveau rôle prenne effet.
        </p>
      </div>
    </div>
  );
}
