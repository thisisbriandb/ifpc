"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  getUsers, updateUserRole, getPendingUsers, approveUser, rejectUser,
  getAdminProductConfig, updateProductConfig,
} from "@/lib/api";
import {
  Shield, ShieldCheck, ShieldAlert, Users, Loader2, Search,
  CheckCircle, XCircle, Save, Settings2, UserCheck, Package,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface UserData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  enabled: boolean;
  lastLogin: string | null;
}

function makeFormatLastLogin(t: (k: string, p?: Record<string, string | number>) => string) {
  return function formatLastLogin(iso: string | null): string {
    if (!iso) return t("admin.never");
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    if (diffMin < 1) return t("admin.justNow");
    if (diffMin < 60) return t("admin.minutesAgo", { n: diffMin });
    if (diffH < 24) return t("admin.hoursAgo", { n: diffH });
    if (diffD < 7) return t("admin.daysAgo", { n: diffD });
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  };
}

interface ProductConfigData {
  id?: number;
  productType: string;
  productName: string;
  vpCible: number;
}

const ROLE_BADGES: Record<string, { badge: string; icon: any }> = {
  ADMIN:   { badge: "bg-red-100 text-red-700",    icon: ShieldAlert },
  EXPERT:  { badge: "bg-orange-100 text-orange-700", icon: ShieldCheck },
  USER:    { badge: "bg-gray-100 text-gray-600",  icon: Users },
  PENDING: { badge: "bg-yellow-100 text-yellow-700", icon: Loader2 },
};

type Tab = "users" | "config" | "pending";

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const { t } = useI18n();
  const formatLastLogin = makeFormatLastLogin(t);
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Pending state
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Product config state
  const [configs, setConfigs] = useState<ProductConfigData[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, number>>({});
  const [savingConfig, setSavingConfig] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push("/");
    }
  }, [isLoading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "users") {
      setUsersLoading(true);
      getUsers()
        .then((data: UserData[]) => setUsers(data.filter(u => u.role !== "ADMIN")))
        .catch(() => {})
        .finally(() => setUsersLoading(false));
    } else if (activeTab === "pending") {
      setPendingLoading(true);
      getPendingUsers()
        .then(setPendingUsers)
        .catch(() => {})
        .finally(() => setPendingLoading(false));
    } else if (activeTab === "config") {
      setConfigsLoading(true);
      getAdminProductConfig()
        .then((data: ProductConfigData[]) => {
          setConfigs(data);
          const initial: Record<string, number> = {};
          data.forEach((c: ProductConfigData) => { initial[c.productType] = c.vpCible; });
          setEditedConfigs(initial);
        })
        .catch(() => {})
        .finally(() => setConfigsLoading(false));
    }
  }, [isAdmin, activeTab]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u).filter(u => u.role !== "ADMIN"));
    } catch { alert(t("admin.updateError")); }
    finally { setUpdatingId(null); }
  };

  const handleApprove = async (userId: number) => {
    setProcessingId(userId);
    try {
      await approveUser(userId);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch { alert(t("admin.approveError")); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (userId: number) => {
    if (!confirm(t("admin.confirmReject"))) return;
    setProcessingId(userId);
    try {
      await rejectUser(userId);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch { alert(t("admin.rejectError")); }
    finally { setProcessingId(null); }
  };

  const handleSaveConfig = async (productType: string) => {
    setSavingConfig(productType);
    try {
      const vpCible = editedConfigs[productType];
      const config = configs.find(c => c.productType === productType);
      await updateProductConfig(productType, vpCible, config?.productName);
      setConfigs(prev => prev.map(c => c.productType === productType ? { ...c, vpCible } : c));
    } catch { alert(t("admin.saveError")); }
    finally { setSavingConfig(null); }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.firstName.toLowerCase().includes(search.toLowerCase()) ||
    u.lastName.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>;
  }

  if (!isAdmin) return null;

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "pending", label: t("admin.tabRequests"), icon: UserCheck, badge: pendingUsers.length },
    { id: "users", label: t("admin.tabUsers"), icon: Users },
    { id: "config", label: t("admin.tabConfig"), icon: Package },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">{t("admin.title")}</h1>
              <p className="text-sm text-red-600 font-medium">{t("admin.subtitle")}</p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Pending Users ──────────────────────────────── */}
        {activeTab === "pending" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-yellow-600" />
                {t("admin.pendingTitle")}
              </h3>
            </div>
            {pendingLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
            ) : pendingUsers.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <UserCheck className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="font-medium">{t("admin.noPending")}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-sm uppercase">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{u.firstName} {u.lastName}</p>
                        <p className="text-sm text-gray-400">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {processingId === u.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(u.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" /> {t("admin.approve")}
                          </button>
                          <button
                            onClick={() => handleReject(u.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <XCircle className="w-4 h-4" /> {t("admin.reject")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Users ──────────────────────────────────────── */}
        {activeTab === "users" && (
          <>
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t("admin.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all"
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {usersLoading ? (
                <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t("admin.colUser")}</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t("admin.colEmail")}</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t("admin.colRole")}</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t("admin.colLastLogin")}</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{t("admin.colEdit")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredUsers.map(u => {
                        const roleMeta = ROLE_BADGES[u.role] ?? ROLE_BADGES.USER;
                        const roleLabel = t(`admin.roleLabels.${u.role}`) !== `admin.roleLabels.${u.role}` ? t(`admin.roleLabels.${u.role}`) : u.role;
                        const RoleIcon = roleMeta.icon;
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
                              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${roleMeta.badge}`}>
                                <RoleIcon className="w-3.5 h-3.5" />
                                {roleLabel}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                title={u.lastLogin ? new Date(u.lastLogin).toLocaleString("fr-FR") : ""}
                                className={`text-xs font-medium ${
                                  u.lastLogin ? "text-gray-500" : "text-gray-300 italic"
                                }`}
                              >
                                {formatLastLogin(u.lastLogin)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {updatingId === u.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
                              ) : (
                                <select
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  className="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-3 py-2 ml-auto block outline-none hover:border-gray-300 cursor-pointer transition-colors focus:ring-2 focus:ring-red-100"
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
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">{t("admin.noUsers")}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Tab: Product Config ─────────────────────────────── */}
        {activeTab === "config" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-brand-primary" />
                {t("admin.configTitle")}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {t("admin.configSubtitle")}
              </p>
            </div>
            {configsLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {configs.map(config => {
                  const edited = editedConfigs[config.productType];
                  const changed = edited !== undefined && edited !== config.vpCible;
                  return (
                    <div key={config.productType} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-900">{config.productName}</p>
                        <p className="text-xs text-gray-400 font-mono">{config.productType}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500 font-medium">{t("admin.vpCibleLabel")}</label>
                          <input
                            type="number"
                            step="0.5"
                            value={editedConfigs[config.productType] ?? config.vpCible}
                            onChange={(e) => setEditedConfigs(prev => ({ ...prev, [config.productType]: parseFloat(e.target.value) || 0 }))}
                            className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-mono text-center focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveConfig(config.productType)}
                          disabled={!changed || savingConfig === config.productType}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            changed
                              ? "bg-brand-primary text-white hover:bg-brand-primary/90 shadow-sm"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {savingConfig === config.productType ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          {t("admin.saveCta")}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {configs.length === 0 && (
                  <div className="p-12 text-center text-gray-400">{t("admin.noConfig")}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
