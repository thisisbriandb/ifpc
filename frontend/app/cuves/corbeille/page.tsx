"use client";

import { useEffect, useState } from "react";
import {
  Container, Trash2, RotateCcw, History, Search, Filter,
  ArrowRight, Clock, User as UserIcon, Loader2, CheckCircle2,
  AlertTriangle, FlaskConical, Calendar, Info, RefreshCw
} from "lucide-react";
import {
  getDeletedCuves,
  getDeletedLots,
  restoreCuve,
  restoreLot,
  getOperations,
  type Cuve,
  type Lot,
  type Operation
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

type TabType = "trash" | "audit";

export default function CorbeillePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isAdmin = !!user;

  const [activeTab, setActiveTab] = useState<TabType>("trash");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data
  const [deletedCuves, setDeletedCuves] = useState<Cuve[]>([]);
  const [deletedLots, setDeletedLots] = useState<Lot[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);

  // Search & Filter
  const [trashSearch, setTrashSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState("ALL");

  // Detailed Modal for Operation
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cuvesData, lotsData, opsData] = await Promise.all([
        getDeletedCuves(),
        getDeletedLots(),
        getOperations()
      ]);
      setDeletedCuves(cuvesData);
      setDeletedLots(lotsData);
      setOperations(opsData);
    } catch (err) {
      console.error("Error loading recycle bin data:", err);
      setErrorMessage("Impossible de charger les données. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (message: string, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 4000);
    } else {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleRestoreCuve = async (id: number, nom: string) => {
    if (!isAdmin) return;
    setActionLoading(id);
    try {
      await restoreCuve(id);
      showToast(`La cuve "${nom}" a été restaurée avec succès.`);
      // reload
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la restauration de la cuve.", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreLot = async (id: number, identifiant: string) => {
    if (!isAdmin) return;
    setActionLoading(id);
    try {
      await restoreLot(id);
      showToast(`Le lot "${identifiant}" a été restauré avec succès.`);
      // reload
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la restauration du lot.", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter deleted items by search
  const filteredCuves = deletedCuves.filter(c =>
    c.nom.toLowerCase().includes(trashSearch.toLowerCase())
  );

  const filteredLots = deletedLots.filter(l =>
    l.identifiant.toLowerCase().includes(trashSearch.toLowerCase()) ||
    l.typeProduit?.toLowerCase().includes(trashSearch.toLowerCase())
  );

  // Filter operations by search & type
  const filteredOperations = operations.filter(op => {
    const matchesType = auditTypeFilter === "ALL" || op.type === auditTypeFilter;
    const searchLower = auditSearch.toLowerCase();
    const matchesSearch =
      (op.description && op.description.toLowerCase().includes(searchLower)) ||
      (op.lotIdentifiant && op.lotIdentifiant.toLowerCase().includes(searchLower)) ||
      (op.lotResultatIdentifiant && op.lotResultatIdentifiant.toLowerCase().includes(searchLower)) ||
      (op.cuveSourceNom && op.cuveSourceNom.toLowerCase().includes(searchLower)) ||
      (op.cuveDestNom && op.cuveDestNom.toLowerCase().includes(searchLower)) ||
      (op.type && op.type.toLowerCase().includes(searchLower)) ||
      (op.userEmail && op.userEmail.toLowerCase().includes(searchLower));

    return matchesType && matchesSearch;
  });

  const getOperationBadgeColor = (type: string) => {
    switch (type) {
      case "NETTOYAGE":
        return "bg-green-50 text-green-700 border-green-100";
      case "REMPLISSAGE":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "TRANSFERT":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "TRANSFORMATION":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "ASSEMBLAGE":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "SUPPRESSION_CUVE":
      case "SUPPRESSION_LOT":
        return "bg-red-50 text-red-700 border-red-100";
      case "RESTAURATION_CUVE":
      case "RESTAURATION_LOT":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Toast Notification Container */}
        <div className="fixed top-6 right-6 z-50 space-y-3 pointer-events-none">
          {successMessage && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm font-semibold rounded-xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm font-semibold rounded-xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Corbeille &amp; Suivi d&apos;Audit</h1>
              <p className="text-sm text-gray-500">Restaurez des entités supprimées et visualisez l&apos;historique complet des mouvements</p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-all self-start sm:self-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </header>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab("trash")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "trash"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Corbeille de Recyclage ({deletedCuves.length + deletedLots.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "audit"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Registre d&apos;Audit ({operations.length})
          </button>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
          </div>
        )}

        {!loading && activeTab === "trash" && (
          <div className="space-y-8">
            {/* SEARCH */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une cuve ou un lot supprimé..."
                value={trashSearch}
                onChange={(e) => setTrashSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
              />
            </div>

            {/* SPLIT GRIDS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* DELETED CUVES */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Container className="w-5 h-5 text-gray-400" />
                  <h2 className="font-bold text-gray-800 text-lg">Cuves Supprimées ({filteredCuves.length})</h2>
                </div>

                {filteredCuves.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                    <Container className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Aucune cuve dans la corbeille</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCuves.map(cuve => (
                      <div
                        key={cuve.id}
                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:scale-[1.005] transition-all duration-200"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{cuve.nom}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Capacité: {cuve.volumeMax.toLocaleString()} hl</p>
                          {cuve.statutPhysique && (
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1.5 ${
                              cuve.statutPhysique === "PROPRE" ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-500 border-red-100"
                            }`}>
                              {cuve.statutPhysique}
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => cuve.id && handleRestoreCuve(cuve.id, cuve.nom)}
                            disabled={actionLoading === cuve.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white font-bold rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
                          >
                            {actionLoading === cuve.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Restaurer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DELETED LOTS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <FlaskConical className="w-5 h-5 text-gray-400" />
                  <h2 className="font-bold text-gray-800 text-lg">Lots Supprimés ({filteredLots.length})</h2>
                </div>

                {filteredLots.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                    <FlaskConical className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Aucun lot dans la corbeille</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredLots.map(lot => (
                      <div
                        key={lot.id}
                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:scale-[1.005] transition-all duration-200"
                      >
                        <div className="min-w-0 flex items-start gap-3">
                          {lot.colorHex && (
                            <div
                              className="w-4 h-10 rounded-full border border-black/5 shrink-0 shadow-inner"
                              style={{ backgroundColor: lot.colorHex }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate font-mono">{lot.identifiant}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{lot.typeProduit || "Type non défini"}</p>
                            <p className="text-xs text-indigo-600 font-bold mt-1">{lot.volumeActuel.toLocaleString()} hl</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => lot.id && handleRestoreLot(lot.id, lot.identifiant)}
                            disabled={actionLoading === lot.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white font-bold rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
                          >
                            {actionLoading === lot.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Restaurer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* OPERATIONS LEDGER */}
        {!loading && activeTab === "audit" && (
          <div className="space-y-6">
            {/* SEARCH AND FILTERS */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par cuve, lot, description..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value={auditTypeFilter}
                  onChange={(e) => setAuditTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/25 cursor-pointer"
                >
                  <option value="ALL">Toutes les opérations</option>
                  <option value="NETTOYAGE">Nettoyages</option>
                  <option value="REMPLISSAGE">Remplissages</option>
                  <option value="TRANSFERT">Transferts</option>
                  <option value="TRANSFORMATION">Transformations</option>
                  <option value="ASSEMBLAGE">Assemblages</option>
                  <option value="SUPPRESSION_CUVE">Suppressions Cuve</option>
                  <option value="RESTAURATION_CUVE">Restaurations Cuve</option>
                  <option value="SUPPRESSION_LOT">Suppressions Lot</option>
                  <option value="RESTAURATION_LOT">Restaurations Lot</option>
                </select>
              </div>
            </div>

            {/* LEDGER TABLE */}
            {filteredOperations.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
                <History className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Aucune opération enregistrée ou ne correspond aux critères</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Horodatage</th>
                        <th className="py-3.5 px-4">Type</th>
                        <th className="py-3.5 px-4">Description</th>
                        <th className="py-3.5 px-4">Utilisateur</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {filteredOperations.map(op => (
                        <tr key={op.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-gray-500 font-mono whitespace-nowrap">
                            {formatDateTime(op.createdAt)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 border text-[9px] font-bold rounded-lg ${getOperationBadgeColor(op.type)}`}>
                              {op.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700 font-medium max-w-xs sm:max-w-md truncate">
                            {op.description}
                          </td>
                          <td className="py-3 px-4 text-gray-500 truncate max-w-[120px]">
                            {op.userEmail || "Système"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setSelectedOperation(op)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-primary hover:text-brand-primary/80 transition-colors"
                            >
                              <Info className="w-3.5 h-3.5" />
                              Détails
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DETAILED VIEW MODAL */}
        {selectedOperation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <header className="px-6 py-4 bg-gradient-to-r from-gray-50 to-indigo-50/20 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-bold text-gray-900 text-base">Détails de l&apos;Opération</h2>
                    <p className="text-[10px] text-gray-400 mt-0.5">ID: #{selectedOperation.id}</p>
                  </div>
                  <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-lg ${getOperationBadgeColor(selectedOperation.type)}`}>
                    {selectedOperation.type}
                  </span>
                </div>
              </header>

              <div className="p-6 space-y-4 text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl">
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">Utilisateur</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-gray-700 font-medium">
                      <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate max-w-[150px]">{selectedOperation.userEmail || "Système"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">Date & Heure</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-gray-700 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formatDateTime(selectedOperation.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Description</p>
                  <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-700 font-medium">
                    {selectedOperation.description}
                  </p>
                </div>

                {/* Physical movements (if applicable) */}
                {(selectedOperation.cuveSourceNom || selectedOperation.cuveDestNom || selectedOperation.lotIdentifiant || selectedOperation.lotResultatIdentifiant) && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Traciabilité & Entités</p>

                    <div className="space-y-2">
                      {/* Vats involved */}
                      {(selectedOperation.cuveSourceNom || selectedOperation.cuveDestNom) && (
                        <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          <Container className="w-4 h-4 text-gray-400 shrink-0" />
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            {selectedOperation.cuveSourceNom ? (
                              <span className="font-semibold text-gray-700 truncate">{selectedOperation.cuveSourceNom}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-gray-300 mx-2 shrink-0" />
                            {selectedOperation.cuveDestNom ? (
                              <span className="font-semibold text-gray-700 truncate">{selectedOperation.cuveDestNom}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Lots involved */}
                      {selectedOperation.lotIdentifiant && (
                        <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-700 font-mono">{selectedOperation.lotIdentifiant}</span>
                          </div>
                          {selectedOperation.volume && (
                            <span className="font-bold text-indigo-600">{selectedOperation.volume.toLocaleString()} hl</span>
                          )}
                        </div>
                      )}

                      {/* Resulting Lot (assemblage) */}
                      {selectedOperation.lotResultatIdentifiant && (
                        <div className="flex items-center justify-between p-2.5 bg-indigo-50/30 rounded-lg border border-indigo-100/50">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-indigo-400" />
                            <div>
                              <span className="font-bold text-indigo-700 font-mono">{selectedOperation.lotResultatIdentifiant}</span>
                              <span className="text-[9px] text-indigo-400 block font-medium">Nouveau lot d&apos;assemblage</span>
                            </div>
                          </div>
                          {selectedOperation.volume && (
                            <span className="font-bold text-indigo-700">{selectedOperation.volume.toLocaleString()} hl</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedOperation(null)}
                  className="w-full mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
