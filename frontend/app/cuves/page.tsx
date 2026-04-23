"use client";

import { useEffect, useState } from "react";
import {
  Container, Plus, Search, Loader2, Edit2, Trash2,
  AlertTriangle, CheckCircle2, FlaskConical, Droplets
} from "lucide-react";
import { getCuves, deleteCuve, createCuve, updateCuve, type Cuve } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function CuvesPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canEdit = user?.role === "ADMIN" || user?.role === "EXPERT";
  const isAdmin = user?.role === "ADMIN";

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

  const handleDelete = async (id: number) => {
    if (!confirm(t("common.confirmDelete") || "Supprimer cette cuve ?")) return;
    try {
      await deleteCuve(id);
      setCuves(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert("Erreur lors de la suppression");
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
        volumeMax: 1000,
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
      if (editingCuve && editingCuve.id) {
        const updated = await updateCuve(editingCuve.id, formData);
        setCuves(prev => prev.map(c => c.id === editingCuve.id ? updated : c));
      } else {
        const created = await createCuve(formData);
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
              const remplissagePct = (cuve.volumeActuel / cuve.volumeMax) * 100;
              return (
                <div key={cuve.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {cuve.colorHex && (
                          <div 
                            className="w-4 h-10 rounded-full border border-black/5 shrink-0 shadow-inner" 
                            style={{ backgroundColor: cuve.colorHex }}
                            title={`L:${cuve.colorL} a:${cuve.colorA} b:${cuve.colorB}`}
                          />
                        )}
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-lg truncate">{cuve.nom}</h3>
                          <p className="text-xs text-gray-400 font-mono truncate">{cuve.typeProduit || "Produit non défini"}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatutColor(cuve.statut)}`}>
                        {cuve.statut}
                      </span>
                    </div>

                    {/* Tank Visualization */}
                    <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-6">
                      <div 
                        className={`absolute inset-y-0 left-0 transition-all duration-1000 ${remplissagePct > 90 ? 'bg-red-400' : 'bg-brand-primary'}`}
                        style={{ width: `${remplissagePct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Volume Actuel</p>
                        <p className="text-sm font-bold text-gray-900">{cuve.volumeActuel.toLocaleString()} L</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Capacité Max</p>
                        <p className="text-sm font-bold text-gray-900">{cuve.volumeMax.toLocaleString()} L</p>
                      </div>
                    </div>

                    {cuve.lotIdentifier && (
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl mb-4 border border-gray-100">
                        <FlaskConical className="w-4 h-4 text-brand-primary" />
                        <span className="text-xs font-mono text-gray-500">Lot: <strong className="text-gray-700">{cuve.lotIdentifier}</strong></span>
                      </div>
                    )}

                    {canEdit && (
                      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-50">
                        <button
                          onClick={() => openModal(cuve)}
                          className="p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => cuve.id && handleDelete(cuve.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Volume Max (L)</label>
                    <input
                      required
                      type="number"
                      value={formData.volumeMax}
                      onChange={(e) => setFormData({ ...formData, volumeMax: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Volume Actuel (L)</label>
                    <input
                      required
                      type="number"
                      value={formData.volumeActuel}
                      onChange={(e) => setFormData({ ...formData, volumeActuel: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Type de produit</label>
                  <input
                    type="text"
                    value={formData.typeProduit}
                    onChange={(e) => setFormData({ ...formData, typeProduit: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                    placeholder="ex: Cidre brut"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Statut</label>
                    <select
                      value={formData.statut}
                      onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                    >
                      <option value="Vide">Vide</option>
                      <option value="En cours">En cours</option>
                      <option value="Pleine">Pleine</option>
                      <option value="En nettoyage">En nettoyage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">N° de Lot</label>
                    <input
                      type="text"
                      value={formData.lotIdentifier}
                      onChange={(e) => setFormData({ ...formData, lotIdentifier: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                      placeholder="ex: LOT-2024-001"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Droplets className="w-3 h-3" />
                    Données Colorimétriques (Optionnel)
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "L*", field: "colorL" },
                      { label: "a*", field: "colorA" },
                      { label: "b*", field: "colorB" },
                    ].map((f) => (
                      <div key={f.field}>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{f.label}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={(formData as any)[f.field] || ""}
                          onChange={(e) => setFormData({ ...formData, [f.field]: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">HEX</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={formData.colorHex || "#ffffff"}
                          onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                          className="w-6 h-7 p-0 border-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.colorHex || ""}
                          onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                          className="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-mono"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                  </div>
                </div>

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
      </div>
    </div>
  );
}
