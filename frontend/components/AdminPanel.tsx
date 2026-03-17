"use client";

import { useState, useEffect } from "react";
import { Users, Shield, ShieldAlert, ShieldCheck, Search, Loader2 } from "lucide-react";
import { getUsers, updateUserRole } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface UserData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function AdminPanel() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      setError("Erreur lors du chargement des utilisateurs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      loadUsers();
    }
  }, [user]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      // Remettre à jour la liste locale
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert("Erreur lors de la mise à jour du rôle.");
    }
  };

  if (user?.role !== "ADMIN") return null;

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-8 max-w-5xl mx-auto">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-primary" />
          Administration des Accès
        </h3>
        
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
          />
        </div>
      </div>

      <div className="p-0">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Utilisateur</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Rôle Actuel</th>
                  <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-xs uppercase">
                          {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                        u.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                        u.role === 'EXPERT' ? 'bg-brand-accent/20 text-brand-accent' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'ADMIN' && <ShieldAlert className="w-3.5 h-3.5" />}
                        {u.role === 'EXPERT' && <ShieldCheck className="w-3.5 h-3.5" />}
                        {u.role === 'USER' && <Users className="w-3.5 h-3.5" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.id !== 1 && ( // Ne pas permettre de changer le rôle du super admin
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-32 p-2 ml-auto outline-none transition-shadow hover:shadow-sm cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="EXPERT">EXPERT</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Aucun utilisateur trouvé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
