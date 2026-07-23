"use client";

import { useEffect, useState, useRef } from "react";
import {
  Container, Plus, Search, Loader2, Edit2, Trash2,
  FlaskConical, AlertTriangle
} from "lucide-react";
import { getCuves, deleteCuve, createCuve, updateCuve, type Cuve } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import CuveSVG from "@/components/CuveSVG";

export default function CuvesPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canEdit = !!user;
  const isAdmin = !!user;

  const [cuves, setCuves] = useState<Cuve[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCuve, setEditingCuve] = useState<Cuve | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<Cuve>({
    nom: "",
    volumeMax: 0,
    volumeActuel: 0,
    typeProduit: "",
    statut: "Vide",
    lotIdentifier: ""
  });

  // Delete modal state
  const [deletingCuve, setDeletingCuve] = useState<Cuve | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadCuves = async () => {
    setLoading(true);
    try {
      const data = await getCuves();
      setCuves(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCuves();
  }, []);

  const openDeleteModal = (cuve: Cuve) => {
    setDeletingCuve(cuve);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const confirmDelete = async () => {
    if (!deletingCuve || !deletingCuve.id) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteCuve(deletingCuve.id);
      setCuves(prev => prev.filter(c => c.id !== deletingCuve.id));
      setIsDeleteModalOpen(false);
      setDeletingCuve(null);
    } catch (err) {
      setDeleteError("Une erreur est survenue lors de la suppression de la cuve.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openModal = (cuve: Cuve | null = null) => {
    if (cuve) {
      setEditingCuve(cuve);
      setFormData({ ...cuve });
    } else {
      setEditingCuve(null);
      setFormData({
        nom: "",
        volumeMax: 20000,
        volumeActuel: 0,
        typeProduit: "",
        statut: "Vide",
        lotIdentifier: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      if (payload.nom && !payload.nom.startsWith("Cuve ")) {
        payload.nom = `Cuve ${payload.nom}`;
      }
      if (editingCuve && editingCuve.id) {
        const updated = await updateCuve(editingCuve.id, payload);
        setCuves(prev => prev.map(c => c.id === editingCuve.id ? updated : c));
      } else {
        const created = await createCuve(payload);
        setCuves(prev => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert("Erreur lors de l'enregistrement");
    } finally {
      setFormLoading(false);
    }
  };

  const filteredCuves = cuves.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.typeProduit?.toLowerCase().includes(search.toLowerCase()) ||
    c.lotIdentifier?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatutColor = (statut?: string) => {
    switch (statut) {
      case "Pleine": return "bg-green-100 text-green-700 border-green-200";
      case "En cours": return "bg-blue-100 text-blue-700 border-blue-200";
      case "Vide": return "bg-gray-100 text-gray-600 border-gray-200";
      case "En nettoyage": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
              <Container className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t("nav.gestionCuves")}</h1>
              <p className="text-sm text-gray-500">{t("nav.suiviCuves")}</p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
            >
              <Plus className="w-5 h-5" />
              Ajouter une cuve
            </button>
          )}
        </header>

        {/* Filters */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une cuve..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-gray-300" />
          </div>
        ) : filteredCuves.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
            <Container className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Aucune cuve trouvée</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCuves.map((cuve) => {
              const volumeActuel = cuve.volumeOccupe ?? cuve.volumeActuel ?? 0;
              return (
                <div key={cuve.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group p-5 flex gap-4 items-center">
                  <div className="shrink-0 flex items-center justify-center bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                    <CuveSVG
                      nom={cuve.nom}
                      volumeMax={cuve.volumeMax}
                      volumeOccupe={volumeActuel}
                      colorHex={cuve.colorHex || cuve.stockages?.[0]?.lotColorHex}
                      statutPhysique={cuve.statutPhysique || (cuve.statut === "En nettoyage" ? "EN_NETTOYAGE" : "PROPRE")}
                      lotIdentifiant={cuve.lotIdentifier || cuve.stockages?.[0]?.lotIdentifiant}
                      width={100}
                      height={170}
                    />
                  </div>
                  <div className="flex-1 min-w-0 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-base truncate">{cuve.nom}</h3>
                          <p className="text-xs text-gray-400 font-mono truncate">{cuve.typeProduit || cuve.stockages?.[0]?.lotTypeProduit || "Produit non défini"}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${getStatutColor(cuve.statut)}`}>
                          {cuve.statut}
                        </span>
                      </div>

                      <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                          <span>VOL ACTUEL:</span>
                          <span className="font-bold text-gray-700">{volumeActuel.toLocaleString()} hl</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                          <span>CAPACITÉ:</span>
                          <span className="font-bold text-gray-700">{cuve.volumeMax.toLocaleString()} hl</span>
                        </div>
                      </div>

                      {cuve.lotIdentifier && (
                        <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded-lg border border-gray-100 mb-3">
                          <FlaskConical className="w-3.5 h-3.5 text-brand-primary" />
                          <span className="text-[10px] font-mono text-gray-500 truncate">Lot: <strong className="text-gray-700">{cuve.lotIdentifier}</strong></span>
                        </div>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-50 mt-auto">
                        <button
                          onClick={() => openModal(cuve)}
                          className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => openDeleteModal(cuve)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tank Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <header className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">
                  {editingCuve ? "Modifier la cuve" : "Ajouter une cuve"}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </header>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Nom de la cuve</label>
                  <input
                    required
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                    placeholder="ex: Cuve A1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Volume Max (hl)</label>
                  <input
                    required
                    type="number"
                    max={20000}
                    value={formData.volumeMax}
                    onChange={(e) => setFormData({ ...formData, volumeMax: Math.min(20000, parseFloat(e.target.value) || 0) })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>

                {editingCuve && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2.5 text-xs text-gray-500">
                    <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px] mb-1">État actuel (Lecture seule)</p>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                      <div>
                        <span className="font-semibold text-gray-400">Statut :</span>{" "}
                        <span className="font-bold text-gray-700">{editingCuve.statut || "Vide"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-400">Volume :</span>{" "}
                        <span className="font-bold text-gray-700">{(editingCuve.volumeOccupe ?? editingCuve.volumeActuel ?? 0).toLocaleString()} hl</span>
                      </div>
                      {editingCuve.lotIdentifier && (
                        <div>
                          <span className="font-semibold text-gray-400">Lot :</span>{" "}
                          <span className="font-bold text-gray-700 font-mono">{editingCuve.lotIdentifier}</span>
                        </div>
                      )}
                      {(editingCuve.typeProduit || editingCuve.stockages?.[0]?.lotTypeProduit) && (
                        <div>
                          <span className="font-semibold text-gray-400">Produit :</span>{" "}
                          <span className="font-bold text-gray-700">{editingCuve.typeProduit || editingCuve.stockages?.[0]?.lotTypeProduit}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-2 px-6 py-2.5 bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all disabled:opacity-50"
                  >
                    {formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enregistrer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && deletingCuve && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <header className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <h2 className="font-bold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Supprimer la cuve
                </h2>
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </header>

              <div className="p-6 space-y-4">
                {deleteError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-100">
                    {deleteError}
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  Êtes-vous sûr de vouloir supprimer définitivement la cuve <strong className="text-gray-900">{deletingCuve.nom}</strong> ? Cette action est irréversible.
                </p>

                {(deletingCuve.lotIdentifier || (deletingCuve.volumeOccupe ?? deletingCuve.volumeActuel ?? 0) > 0) ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2">
                    <p className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Attention : Cuve occupée
                    </p>
                    <p>
                      Cette cuve contient actuellement le lot <strong className="font-mono">{deletingCuve.lotIdentifier || "sans identifiant"}</strong> avec un volume de <strong>{((deletingCuve.volumeOccupe ?? deletingCuve.volumeActuel ?? 0)).toLocaleString()} hl</strong>.
                    </p>
                    <p className="italic text-amber-700">
                      En supprimant cette cuve, le lot associé sera libéré de cette cuve et sera replacé dans votre stock global (non affecté).
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Cette cuve est vide.
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/15"
                  >
                    {deleteLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirmer la suppression"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
