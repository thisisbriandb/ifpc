"use client";

import { useEffect, useState, useRef } from "react";
import {
  Container, Plus, Search, Loader2, Edit2, Trash2,
  AlertTriangle, CheckCircle2, FlaskConical, Droplets, Upload, FileSpreadsheet, X, BarChart3
} from "lucide-react";
import { getCuves, deleteCuve, createCuve, updateCuve, spectrumToLab, type Cuve } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import CuveSVG from "@/components/CuveSVG";

// ── HEX → Lab* conversion ───────────────────────────────────────────────────
function hexToLab(hex: string): { L: number; a: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  // HEX → sRGB [0,1]
  let r = parseInt(m[1].substring(0, 2), 16) / 255;
  let g = parseInt(m[1].substring(2, 4), 16) / 255;
  let b = parseInt(m[1].substring(4, 6), 16) / 255;
  // Linearize (inverse sRGB companding)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  // Linear RGB → XYZ (D65)
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  // XYZ → Lab
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return {
    L: Math.round((116 * fy - 16) * 100) / 100,
    a: Math.round((500 * (fx - fy)) * 100) / 100,
    b: Math.round((200 * (fy - fz)) * 100) / 100,
  };
}

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
  const spectrumInputRef = useRef<HTMLInputElement>(null);
  const [spectrumFile, setSpectrumFile] = useState<File | null>(null);
  const [spectrumPreview, setSpectrumPreview] = useState<{ wavelengths: number[]; do: number[] } | null>(null);
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

  const [computingLab, setComputingLab] = useState(false);

  const parseSpectrumCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.trim().split(/\r?\n/);
      const wavelengths: number[] = [];
      const doValues: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;\t]/).map(s => s.trim());
        const wl = parseFloat(cols[0]);
        const od = parseFloat(cols[1]);
        if (!isNaN(wl) && !isNaN(od)) {
          wavelengths.push(wl);
          doValues.push(od);
        }
      }
      if (wavelengths.length > 0) {
        setSpectrumPreview({ wavelengths, do: doValues });
        setSpectrumFile(file);
        // Auto-compute Lab* from spectrum
        setComputingLab(true);
        try {
          const lab = await spectrumToLab(wavelengths, doValues);
          setFormData(prev => ({ ...prev, colorL: lab.L, colorA: lab.a, colorB: lab.b, colorHex: lab.hex }));
        } catch {
          // silently ignore — user can still save without computed Lab*
        } finally {
          setComputingLab(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const openModal = (cuve: Cuve | null = null) => {
    if (cuve) {
      setEditingCuve(cuve);
      setFormData({ ...cuve });
      if (cuve.spectrumJson) {
        try { setSpectrumPreview(JSON.parse(cuve.spectrumJson)); } catch { setSpectrumPreview(null); }
      } else {
        setSpectrumPreview(null);
      }
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
      setSpectrumPreview(null);
    }
    setSpectrumFile(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      if (spectrumPreview) {
        payload.spectrumJson = JSON.stringify(spectrumPreview);
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
                          <p className="text-xs text-gray-400 font-mono truncate">{cuve.typeProduit || "Produit non défini"}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${getStatutColor(cuve.statut)}`}>
                          {cuve.statut}
                        </span>
                      </div>

                      <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                          <span>VOL ACTUEL:</span>
                          <span className="font-bold text-gray-700">{volumeActuel.toLocaleString()} L</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                          <span>CAPACITÉ:</span>
                          <span className="font-bold text-gray-700">{cuve.volumeMax.toLocaleString()} L</span>
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
                            onClick={() => cuve.id && handleDelete(cuve.id)}
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
                  {computingLab && (
                    <div className="flex items-center gap-2 mb-2 text-[10px] text-brand-primary font-bold">
                      <Loader2 className="w-3 h-3 animate-spin" /> Calcul Lab* depuis le spectre…
                    </div>
                  )}
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
                          readOnly={!!spectrumPreview}
                          value={(formData as any)[f.field] || ""}
                          onChange={(e) => setFormData({ ...formData, [f.field]: parseFloat(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono ${spectrumPreview ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`}
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">HEX</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          disabled={!!spectrumPreview}
                          value={formData.colorHex || "#ffffff"}
                          onChange={(e) => {
                            const hex = e.target.value;
                            const lab = hexToLab(hex);
                            setFormData({ ...formData, colorHex: hex, ...(lab ? { colorL: lab.L, colorA: lab.a, colorB: lab.b } : {}) });
                          }}
                          className={`w-6 h-7 p-0 border-0 bg-transparent ${spectrumPreview ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        />
                        <input
                          type="text"
                          readOnly={!!spectrumPreview}
                          value={formData.colorHex || ""}
                          onChange={(e) => {
                            const hex = e.target.value;
                            const lab = hexToLab(hex);
                            setFormData({ ...formData, colorHex: hex, ...(lab ? { colorL: lab.L, colorA: lab.a, colorB: lab.b } : {}) });
                          }}
                          className={`w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-[10px] font-mono ${spectrumPreview ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`}
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                  </div>
                  {spectrumPreview && (
                    <p className="text-[9px] text-gray-400 mt-1.5 italic">Valeurs calculées depuis le spectre d&apos;absorption</p>
                  )}
                </div>

                {/* Spectrum Upload */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BarChart3 className="w-3 h-3" />
                    Spectre d&apos;absorption (Optionnel)
                  </h4>
                  {spectrumPreview ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-primary/5 border border-brand-primary/10">
                      <FileSpreadsheet className="w-5 h-5 text-brand-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">
                          {spectrumFile ? spectrumFile.name : 'Spectre existant'}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {spectrumPreview.wavelengths.length} points · {spectrumPreview.wavelengths[0]}–{spectrumPreview.wavelengths[spectrumPreview.wavelengths.length - 1]} nm
                        </p>
                      </div>
                      <button type="button" onClick={() => { setSpectrumFile(null); setSpectrumPreview(null); setFormData(prev => ({ ...prev, colorL: undefined, colorA: undefined, colorB: undefined, colorHex: undefined })); }} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => spectrumInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-brand-primary/40 hover:text-brand-primary/60 transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      Importer un fichier CSV (wavelength, DO)
                    </button>
                  )}
                  <input
                    ref={spectrumInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) parseSpectrumCsv(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
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
