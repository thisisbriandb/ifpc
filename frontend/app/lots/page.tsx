"use client";

import { useEffect, useState, useRef } from "react";
import {
  FlaskConical, Plus, Search, Loader2, Edit2, Trash2,
  Upload, FileSpreadsheet, X, BarChart3, Droplets,
  Apple, Sparkles, Waves, List, LayoutGrid, ArrowUpDown,
  Filter, Package, CircleDashed, CircleCheck, Circle, CircleAlert
} from "lucide-react";
import {
  getLots, deleteLot, createLot, updateLot, spectrumToLab,
  type Lot
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

// ── HEX → Lab* conversion ───────────────────────────────────────────────────
function hexToLab(hex: string): { L: number; a: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  let r = parseInt(m[1].substring(0, 2), 16) / 255;
  let g = parseInt(m[1].substring(2, 4), 16) / 255;
  let b = parseInt(m[1].substring(4, 6), 16) / 255;
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return {
    L: Math.round((116 * fy - 16) * 100) / 100,
    a: Math.round((500 * (fx - fy)) * 100) / 100,
    b: Math.round((200 * (fy - fz)) * 100) / 100,
  };
}

const STATUT_OPTIONS = [
  { value: "EN_FERMENTATION", label: "En fermentation" },
  { value: "PRET_A_ASSEMBLER", label: "Prêt à assembler" },
  { value: "EMBOUTEILLE", label: "Embouteillé" },
];

const TYPE_PRODUIT_OPTIONS = [
  "Jus de pomme", "Moût", "Cidre doux", "Cidre demi-sec", "Cidre brut", "Cidre extra-brut",
];

const getStatusBadge = (statut?: string) => {
  switch (statut) {
    case "EN_FERMENTATION":
      return {
        label: "En fermentation",
        bg: "bg-gray-50 text-gray-700 border-gray-200",
        Icon: CircleDashed,
        iconClass: "text-amber-600",
      };
    case "PRET_A_ASSEMBLER":
      return {
        label: "Prêt à assembler",
        bg: "bg-gray-50 text-gray-700 border-gray-200",
        Icon: CircleCheck,
        iconClass: "text-brand-primary",
      };
    case "EMBOUTEILLE":
      return {
        label: "Embouteillé",
        bg: "bg-gray-50 text-gray-700 border-gray-200",
        Icon: Circle,
        iconClass: "text-slate-500",
      };
    case "BLOQUE":
      return {
        label: "Bloqué",
        bg: "bg-gray-50 text-gray-700 border-gray-200",
        Icon: CircleAlert,
        iconClass: "text-red-600",
      };
    default:
      return {
        label: statut || "—",
        bg: "bg-gray-50 text-gray-600 border-gray-200",
        Icon: Circle,
        iconClass: "text-gray-400",
      };
  }
};

const PRODUCT_BADGE_CLASS = "bg-gray-50 text-gray-600 border-gray-200";

const getProductDisplay = (typeProduit?: string) => {
  const typeLower = typeProduit?.toLowerCase() || "";
  if (typeLower.includes("jus")) return { Icon: Apple };
  if (typeLower.includes("cidre")) return { Icon: Sparkles };
  if (typeLower.includes("moût") || typeLower.includes("mout")) return { Icon: FlaskConical };
  return { Icon: Droplets };
};

export default function LotsPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canEdit = !!user;

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const spectrumInputRef = useRef<HTMLInputElement>(null);
  const [spectrumFile, setSpectrumFile] = useState<File | null>(null);
  const [spectrumPreview, setSpectrumPreview] = useState<{ wavelengths: number[]; do: number[] } | null>(null);
  const [computingLab, setComputingLab] = useState(false);
  const [formData, setFormData] = useState<Partial<Lot>>({
    identifiant: "",
    typeProduit: "",
    volumeActuel: 0,
    statutLot: "EN_FERMENTATION",
  });

  // Load Saved View Mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ifpc_lots_view_mode");
      if (saved === "table" || saved === "cards") {
        setViewMode(saved);
      }
    }
  }, []);

  const handleSetViewMode = (mode: "table" | "cards") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("ifpc_lots_view_mode", mode);
    }
  };

  const loadLots = async () => {
    setLoading(true);
    try {
      const data = await getLots();
      setLots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLots(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce lot ?")) return;
    try {
      await deleteLot(id);
      setLots(prev => prev.filter(l => l.id !== id));
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const parseSpectrumFile = async (file: File) => {
    setComputingLab(true);
    try {
      const fileNameLower = file.name.toLowerCase();
      const isExcel = fileNameLower.endsWith(".xlsx") || fileNameLower.endsWith(".xls");
      let wavelengths: number[] = [];
      let doValues: number[] = [];

      if (isExcel) {
        const data = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;
          const wl = parseFloat(String(row[0]).replace(",", "."));
          const od = parseFloat(String(row[1]).replace(",", "."));
          if (!isNaN(wl) && !isNaN(od)) {
            wavelengths.push(wl);
            doValues.push(od);
          }
        }
      } else {
        const text = await file.text();
        let sep = ",";
        if (text.includes("\t")) {
          sep = "\t";
        } else if (text.includes(";")) {
          sep = ";";
        }
        const lines = text.trim().split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(sep).map(s => s.trim());
          if (cols.length < 2) continue;
          const wl = parseFloat(cols[0].replace(",", "."));
          const od = parseFloat(cols[1].replace(",", "."));
          if (!isNaN(wl) && !isNaN(od)) {
            wavelengths.push(wl);
            doValues.push(od);
          }
        }
      }

      if (wavelengths.length > 0) {
        // Sort by wavelength ascending to ensure correct interpolation on the backend
        const paired = wavelengths.map((wl, idx) => ({ wl, od: doValues[idx] }));
        paired.sort((a, b) => a.wl - b.wl);
        const sortedWavelengths = paired.map(p => p.wl);
        const sortedDoValues = paired.map(p => p.od);

        setSpectrumPreview({ wavelengths: sortedWavelengths, do: sortedDoValues });
        setSpectrumFile(file);
        try {
          const lab = await spectrumToLab(sortedWavelengths, sortedDoValues);
          setFormData(prev => ({ ...prev, colorL: lab.L, colorA: lab.a, colorB: lab.b, colorHex: lab.hex }));
        } catch (err) {
          console.error("Erreur de calcul Lab* depuis le spectre:", err);
          alert("Erreur lors du calcul des coordonnées colorimétriques Lab* depuis le spectre. Veuillez vérifier les données du fichier.");
        }
      } else {
        alert("Aucune donnée valide trouvée dans le fichier (colonne 1: longueur d'onde, colonne 2: DO)");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la lecture du fichier de spectre");
    } finally {
      setComputingLab(false);
    }
  };

  const openModal = (lot: Lot | null = null) => {
    if (lot) {
      setEditingLot(lot);
      setFormData({ ...lot });
      if (lot.spectrumJson) {
        try { setSpectrumPreview(JSON.parse(lot.spectrumJson)); } catch { setSpectrumPreview(null); }
      } else { setSpectrumPreview(null); }
    } else {
      setEditingLot(null);
      setFormData({ identifiant: "", typeProduit: "", volumeActuel: 0, statutLot: "EN_FERMENTATION" });
      setSpectrumPreview(null);
    }
    setSpectrumFile(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload: any = { ...formData };
      if (spectrumPreview) payload.spectrumJson = JSON.stringify(spectrumPreview);
      if (editingLot && editingLot.id) {
        const updated = await updateLot(editingLot.id, payload);
        setLots(prev => prev.map(l => l.id === editingLot.id ? updated : l));
      } else {
        const created = await createLot(payload);
        setLots(prev => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch {
      alert("Erreur lors de l'enregistrement");
    } finally { setFormLoading(false); }
  };

  // Filter lots
  const filteredLots = lots.filter(lot => {
    const matchesSearch = 
      lot.identifiant?.toLowerCase().includes(search.toLowerCase()) ||
      lot.typeProduit?.toLowerCase().includes(search.toLowerCase()) ||
      (lot.cuveActuelle?.cuveNom && lot.cuveActuelle.cuveNom.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || lot.statutLot === statusFilter;
    const matchesType = typeFilter === "ALL" || lot.typeProduit === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Sort lots
  const sortedLots = [...filteredLots].sort((a, b) => {
    if (sortBy === "identifiant_asc") {
      return (a.identifiant || "").localeCompare(b.identifiant || "");
    }
    if (sortBy === "identifiant_desc") {
      return (b.identifiant || "").localeCompare(a.identifiant || "");
    }
    if (sortBy === "volume_desc") {
      return (b.volumeActuel || 0) - (a.volumeActuel || 0);
    }
    if (sortBy === "volume_asc") {
      return (a.volumeActuel || 0) - (b.volumeActuel || 0);
    }
    if (sortBy === "recent") {
      return (b.id || 0) - (a.id || 0);
    }
    return 0;
  });

  // Dynamic Dashboard Stats (calculated from complete loaded dataset)
  const overallTotalLots = lots.length;
  const overallTotalVolume = lots.reduce((acc, curr) => acc + (curr.volumeActuel || 0), 0);
  const overallFermentationCount = lots.filter(l => l.statutLot === "EN_FERMENTATION").length;
  const overallReadyCount = lots.filter(l => l.statutLot === "PRET_A_ASSEMBLER").length;

  return (
    <div className="min-h-screen bg-brand-gray py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b border-gray-200/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center border border-gray-200 shadow-sm">
              <FlaskConical className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t("nav.lots")}</h1>
              <p className="text-sm text-gray-500 font-medium">Pilotage et suivi de production cidricole</p>
            </div>
          </div>
          {canEdit && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-bold rounded-lg shadow-sm hover:bg-brand-primary/95 active:translate-y-0 transition-all duration-200"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" /> Nouveau lot
            </button>
          )}
        </header>

        {/* ── Pilotage Production Dashboard (KPI Cards) ──────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Card 1: Total Lots */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm transition-all duration-200 flex items-center justify-between group">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total lots</p>
              <p className="text-3xl font-black text-gray-950 mt-1">{overallTotalLots}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Lots sous traçabilité</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Total Volume */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm transition-all duration-200 flex items-center justify-between group">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Volume total</p>
              <p className="text-3xl font-black text-gray-950 mt-1">{overallTotalVolume.toLocaleString()} hl</p>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Volume liquide total</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 flex items-center justify-center shrink-0">
              <Waves className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: En Fermentation */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm transition-all duration-200 flex items-center justify-between group">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En fermentation</p>
              <p className="text-3xl font-black text-gray-950 mt-1">{overallFermentationCount}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Phase active de fermentation</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
              <CircleDashed className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          {/* Card 4: Prets à assembler */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm transition-all duration-200 flex items-center justify-between group">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Prêts à assembler</p>
              <p className="text-3xl font-black text-gray-950 mt-1">{overallReadyCount}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Disponibles pour coupage</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
              <CircleCheck className="w-5 h-5 text-brand-primary" />
            </div>
          </div>
        </div>

        {/* ── Advanced Search, Filtering, and Sorting Bar ───────────────── */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Search Box */}
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher par identifiant, type, cuve..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all duration-200" 
            />
          </div>

          {/* Filters, Sorters & View Toggle */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
            
            {/* Filter Status */}
            <div className="flex items-center gap-1.5 bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer pr-1"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="EN_FERMENTATION">En fermentation</option>
                <option value="PRET_A_ASSEMBLER">Prêts à assembler</option>
                <option value="EMBOUTEILLE">Embouteillés</option>
              </select>
            </div>

            {/* Filter Product Type */}
            <div className="flex items-center gap-1.5 bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2">
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer pr-1"
              >
                <option value="ALL">Tous les types de produit</option>
                {TYPE_PRODUIT_OPTIONS.map(tp => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer pr-1"
              >
                <option value="recent">Récents en premier</option>
                <option value="identifiant_asc">Identifiant (A-Z)</option>
                <option value="identifiant_desc">Identifiant (Z-A)</option>
                <option value="volume_desc">Volume (Décroissant)</option>
                <option value="volume_asc">Volume (Croissant)</option>
              </select>
            </div>

            {/* Visual Separator */}
            <div className="h-6 w-px bg-gray-200 hidden xl:block mx-1" />

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => handleSetViewMode("table")}
                className={`p-1.5 rounded-lg transition-all duration-150 ${viewMode === "table" ? "bg-white text-brand-primary shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                title="Vue Tableau (Recommandé)"
              >
                <List className="w-4 h-4 stroke-[2.5]" />
              </button>
              <button
                onClick={() => handleSetViewMode("cards")}
                className={`p-1.5 rounded-lg transition-all duration-150 ${viewMode === "cards" ? "bg-white text-brand-primary shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                title="Vue Cartes Modernes"
              >
                <LayoutGrid className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

          </div>
        </div>

        {/* ── Lots Render Section ────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-brand-primary" /></div>
        ) : sortedLots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center shadow-sm">
            <FlaskConical className="w-14 h-14 text-gray-300 mx-auto mb-4 stroke-[1.5]" />
            <p className="text-gray-600 font-bold text-lg">Aucun lot ne correspond à vos critères</p>
            <p className="text-gray-400 text-sm mt-1">Essayez d&apos;ajuster vos filtres de recherche ou de tri</p>
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
              }}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition-all"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : viewMode === "table" ? (
          
          /* OPTION 1: HIGHLY RECOMMENDED TABLE VIEW */
          <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200 shadow-sm transition-all duration-300">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-4 px-5">Lot / Produit</th>
                  <th className="py-4 px-5">Statut</th>
                  <th className="py-4 px-5 text-right">Volume</th>
                  <th className="py-4 px-5">Stockage</th>
                  <th className="py-4 px-5">Données Colorimétriques (CIELAB)</th>
                  {canEdit && <th className="py-4 px-5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLots.map((lot) => {
                  const statusInfo = getStatusBadge(lot.statutLot);
                  const StatusIcon = statusInfo.Icon;
                  const hasSpectrum = !!lot.spectrumJson;

                  const { Icon: ProductIcon } = getProductDisplay(lot.typeProduit);

                  return (
                    <tr 
                      key={lot.id} 
                      className="hover:bg-gray-50/60 transition-colors group text-sm"
                    >
                      {/* Lot / Product */}
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono font-bold text-gray-900 text-[13px] tracking-tight">
                            {lot.identifiant}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border self-start ${PRODUCT_BADGE_CLASS}`}>
                            <ProductIcon className="w-3 h-3" />
                            {lot.typeProduit || "Type non défini"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.bg}`}>
                          <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${statusInfo.iconClass}`} />
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="py-3.5 px-5 text-right font-bold text-gray-900 tabular-nums">
                        {lot.volumeActuel.toLocaleString()} hl
                      </td>

                      {/* Tank Storage */}
                      <td className="py-3.5 px-5">
                        {lot.cuveActuelle ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-brand-primary/5 text-brand-primary font-bold text-xs border border-brand-primary/10">
                            Cuve {lot.cuveActuelle.cuveNom}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic font-medium text-xs">Non cuvé</span>
                        )}
                      </td>

                      {/* Color coordinates */}
                      <td className="py-3.5 px-5">
                        {lot.colorHex ? (
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-6 h-6 rounded-lg border border-black/10 shrink-0 shadow-inner" 
                              style={{ 
                                backgroundColor: lot.colorHex,
                                boxShadow: `0 0 8px ${lot.colorHex}25`
                              }} 
                            />
                            <div className="flex flex-col">
                              <span className="text-[11px] font-mono text-gray-600 font-semibold">
                                L*={lot.colorL?.toFixed(1)} a*={lot.colorA?.toFixed(1)} b*={lot.colorB?.toFixed(1)}
                              </span>
                              <span className="text-[9px] font-mono text-gray-400 mt-0.5 font-bold uppercase tracking-wider">{lot.colorHex}</span>
                            </div>
                            {hasSpectrum && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/10">
                                <BarChart3 className="w-2.5 h-2.5" />
                                Spectre
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 italic text-xs">Aucune mesure</span>
                        )}
                      </td>

                      {/* Actions */}
                      {canEdit && (
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button 
                              onClick={() => openModal(lot)}
                              className="p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-all"
                              title="Modifier le lot"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => lot.id && handleDelete(lot.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Supprimer le lot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          
          /* OPTION 2: COMPACT AND MODERN CARDS VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedLots.map((lot) => {
              const statusInfo = getStatusBadge(lot.statutLot);
              const StatusIcon = statusInfo.Icon;
              const hasSpectrum = !!lot.spectrumJson;

              const { Icon: ProductIcon } = getProductDisplay(lot.typeProduit);

              return (
                <div 
                  key={lot.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-all duration-200 flex flex-col justify-between overflow-hidden relative"
                >
                  <div className="p-4 flex flex-col justify-between flex-1 gap-2.5">
                    {/* Top line: Status badge & Product icon */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.bg}`}>
                        <StatusIcon className={`w-3 h-3 shrink-0 ${statusInfo.iconClass}`} />
                        {statusInfo.label}
                      </span>
                      
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${PRODUCT_BADGE_CLASS}`}>
                        <ProductIcon className="w-3 h-3" />
                        {lot.typeProduit || "Autre"}
                      </span>
                    </div>

                    {/* Lot ID */}
                    <div className="my-0.5">
                      <h3 className="font-mono font-bold text-gray-900 text-[13px] truncate" title={lot.identifiant}>
                        {lot.identifiant}
                      </h3>
                    </div>

                    {/* Main values: Volume & Vat */}
                    <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-gray-100 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider">Volume</span>
                        <span className="font-black text-gray-950 text-[13px]">{lot.volumeActuel.toLocaleString()} hl</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider text-right">Stockage</span>
                        {lot.cuveActuelle ? (
                          <span className="font-bold text-brand-primary truncate block text-right text-[12px]">
                            Cuve {lot.cuveActuelle.cuveNom}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic block text-right text-[11px]">Non cuvé</span>
                        )}
                      </div>
                    </div>

                    {/* Bottom: Color coordinate & Action controls */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {lot.colorHex ? (
                          <>
                            <div 
                              className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-inner" 
                              style={{ backgroundColor: lot.colorHex }} 
                              title={`Hex: ${lot.colorHex}`}
                            />
                            <span className="truncate text-[9.5px] font-semibold text-gray-500" title={`L*=${lot.colorL} a*=${lot.colorA} b*=${lot.colorB}`}>
                              ({lot.colorL?.toFixed(0)}, {lot.colorA?.toFixed(0)}, {lot.colorB?.toFixed(0)})
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-300 italic text-[10px]">Sans couleur</span>
                        )}
                        {hasSpectrum && !lot.colorHex && (
                          <span className="text-brand-primary" title="Spectre disponible">
                            <BarChart3 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        {canEdit && (
                          <>
                            <button 
                              onClick={() => openModal(lot)}
                              className="p-1 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded transition-all"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => lot.id && handleDelete(lot.id)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Edit or Create Lot */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <header className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
                <h2 className="font-bold text-gray-900">{editingLot ? "Modifier le lot" : "Nouveau lot"}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </header>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Identifiant du lot</label>
                  <input required type="text" value={formData.identifiant || ""}
                    onChange={(e) => setFormData({ ...formData, identifiant: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                    placeholder="ex: LOT-2026-POM-01" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Type de produit</label>
                    <select value={formData.typeProduit || ""}
                      onChange={(e) => setFormData({ ...formData, typeProduit: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none">
                      <option value="">Sélectionner...</option>
                      {TYPE_PRODUIT_OPTIONS.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Volume (hl)</label>
                    <input required type="number" value={formData.volumeActuel || 0}
                      onChange={(e) => setFormData({ ...formData, volumeActuel: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Statut</label>
                  <select value={formData.statutLot || "EN_FERMENTATION"}
                    onChange={(e) => setFormData({ ...formData, statutLot: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none">
                    {STATUT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                {/* Colorimetric Data */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Droplets className="w-3 h-3 text-brand-primary" /> Données Colorimétriques (Optionnel)
                  </h4>
                  {computingLab && (
                    <div className="flex items-center gap-2 mb-2 text-[10px] text-brand-primary font-bold">
                      <Loader2 className="w-3 h-3 animate-spin" /> Calcul Lab* depuis le spectre…
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {[{ label: "L*", field: "colorL" }, { label: "a*", field: "colorA" }, { label: "b*", field: "colorB" }].map((f) => (
                      <div key={f.field}>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">{f.label}</label>
                        <input type="number" step="0.01" readOnly={!!spectrumPreview}
                          value={(formData as any)[f.field] || ""}
                          onChange={(e) => setFormData({ ...formData, [f.field]: parseFloat(e.target.value) || 0 })}
                          className={`w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono ${spectrumPreview ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">HEX</label>
                      <div className="flex items-center gap-1.5">
                        <input type="color" disabled={!!spectrumPreview} value={formData.colorHex || "#ffffff"}
                          onChange={(e) => {
                            const hex = e.target.value;
                            const lab = hexToLab(hex);
                            setFormData({ ...formData, colorHex: hex, ...(lab ? { colorL: lab.L, colorA: lab.a, colorB: lab.b } : {}) });
                          }}
                          className={`w-6 h-7 p-0 border-0 bg-transparent ${spectrumPreview ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} />
                        <input type="text" readOnly={!!spectrumPreview} value={formData.colorHex || ""}
                          onChange={(e) => {
                            const hex = e.target.value;
                            const lab = hexToLab(hex);
                            setFormData({ ...formData, colorHex: hex, ...(lab ? { colorL: lab.L, colorA: lab.a, colorB: lab.b } : {}) });
                          }}
                          className={`w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-[10px] font-mono ${spectrumPreview ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`}
                          placeholder="#FFFFFF" />
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
                    <BarChart3 className="w-3 h-3 text-brand-primary" /> Spectre d&apos;absorption (Optionnel)
                  </h4>
                  {spectrumPreview ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-primary/5 border border-brand-primary/10">
                      <FileSpreadsheet className="w-5 h-5 text-brand-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{spectrumFile ? spectrumFile.name : 'Spectre existant'}</p>
                        <p className="text-[10px] text-gray-400">
                          {spectrumPreview.wavelengths.length} points · {spectrumPreview.wavelengths[0]}–{spectrumPreview.wavelengths[spectrumPreview.wavelengths.length - 1]} nm
                        </p>
                      </div>
                      <button type="button" onClick={() => { setSpectrumFile(null); setSpectrumPreview(null); setFormData(prev => ({ ...prev, colorL: undefined, colorA: undefined, colorB: undefined, colorHex: undefined })); }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => spectrumInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-brand-primary/40 hover:text-brand-primary/60 transition-all">
                    <Upload className="w-4 h-4" /> Importer un fichier CSV ou Excel (wavelength, DO)
                    </button>
                  )}
                  <input ref={spectrumInputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) parseSpectrumFile(f); e.target.value = ''; }}
                    className="hidden" />
                </div>

                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all">
                    Annuler
                  </button>
                  <button type="submit" disabled={formLoading}
                    className="flex-2 px-6 py-2.5 bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/95 transition-all disabled:opacity-50">
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
