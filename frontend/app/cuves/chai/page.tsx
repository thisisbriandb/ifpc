"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Container, Loader2, ArrowRight, Plus, X, Upload, AlertTriangle,
  RefreshCw, Sparkles, FlaskConical, Palette, Blend,
  BarChart3, Calendar, Grape, Archive, Wrench, PackageOpen,
  GripVertical
} from "lucide-react";
import {
  getCuves, getLots, createCuve, createLot, opNettoyage, opRemplissage, opTransfert, opTransformation, opAssemblage, spectrumToLab,
  type Cuve, type Lot
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import CuveSVG, { type CuveDragState } from "@/components/CuveSVG";

interface DragPayload {
  lotId: number;
  lotIdentifiant: string;
  cuveSourceId: number;
  cuveSourceNom: string;
  volumeOccupe: number;
  colorHex?: string | null;
  isUnassigned?: boolean;
}

type PanelView = null | "lot-detail" | "cuve-status" | "create-cuve" | "create-lot";
type ModalView = null | "transfert" | "assemblage";

export default function ChaiVirtuelPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [cuves, setCuves] = useState<Cuve[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dragOverCuveId, setDragOverCuveId] = useState<number | null>(null);
  const didDragRef = useRef(false);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Lots popup
  const [showLotsPopup, setShowLotsPopup] = useState(false);
  // Panel state (right side)
  const [panelView, setPanelView] = useState<PanelView>(null);
  const [selectedCuve, setSelectedCuve] = useState<Cuve | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);

  // Modal state
  const [modalView, setModalView] = useState<ModalView>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [transferVolume, setTransferVolume] = useState<number>(0);
  const [targetCuve, setTargetCuve] = useState<Cuve | null>(null);

  // Assemblage modal state
  const [assemblageSrcA, setAssemblageSrcA] = useState<{ cuve: Cuve; lot: Lot; volume: number } | null>(null);
  const [assemblageSrcB, setAssemblageSrcB] = useState<{ cuve: Cuve; lot: Lot; volume: number } | null>(null);
  const [assemblageDestCuveId, setAssemblageDestCuveId] = useState<number | null>(null);
  const [assemblageNewLotId, setAssemblageNewLotId] = useState("");
  const [assemblageError, setAssemblageError] = useState<string | null>(null);

  // Create forms
  const [newCuveNom, setNewCuveNom] = useState("");
  const [newCuveVolume, setNewCuveVolume] = useState<number>(1000);
  const [newLotId, setNewLotId] = useState("");
  const [newLotType, setNewLotType] = useState("");
  const [newLotVolume, setNewLotVolume] = useState<number>(0);
  const [newLotSpectrum, setNewLotSpectrum] = useState<{ wavelengths: number[]; do: number[] } | null>(null);
  const [newLotColor, setNewLotColor] = useState<{ L: number; a: number; b: number; hex: string } | null>(null);
  const [spectrumLoading, setSpectrumLoading] = useState(false);
  const [spectrumFileName, setSpectrumFileName] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cuvesData, lotsData] = await Promise.all([getCuves(), getLots()]);
      setCuves(cuvesData);
      setLots(lotsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Drag Guidance Logic ────────────────────────────────────────────────────

  const getCuveDragState = (cuve: Cuve): CuveDragState => {
    if (!isDragging || !dragPayload) return "idle";
    if (!dragPayload.isUnassigned && cuve.id === dragPayload.cuveSourceId) return "dragging";
    if (dragOverCuveId === cuve.id) return "drag-over";

    // Can this cuve accept the drop?
    const hasContent = (cuve.stockages?.length || 0) > 0;
    const isPropre = cuve.statutPhysique === "PROPRE";
    const volumeDisponible = cuve.volumeMax - (cuve.volumeOccupe || 0);

    if (dragPayload.isUnassigned) {
      // Unassigned lots can only go into empty, clean cuves
      const canAccept = isPropre && !hasContent && volumeDisponible > 0;
      return canAccept ? "valid-target" : "invalid-target";
    }

    const canAccept = (isPropre || hasContent) && volumeDisponible > 0;
    return canAccept ? "valid-target" : "invalid-target";
  };

  // ── Click Handlers ─────────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCuveClick = (cuve: Cuve) => {
    // Skip click if a drag just ended
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const hasContent = (cuve.stockages?.length || 0) > 0;
    setSelectedCuve(cuve);

    if (hasContent && cuve.stockages?.[0]) {
      // Find the lot from our lots array for full detail
      const lotId = cuve.stockages[0].lotId;
      const lot = lots.find(l => l.id === lotId) || null;
      setSelectedLot(lot);
      setPanelView("lot-detail");
    } else {
      setSelectedLot(null);
      setPanelView("cuve-status");
    }
  };

  // ── Drag Handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, cuve: Cuve) => {
    const stockage = cuve.stockages?.[0];
    if (!stockage) return;

    const payload: DragPayload = {
      lotId: stockage.lotId,
      lotIdentifiant: stockage.lotIdentifiant || "",
      cuveSourceId: cuve.id!,
      cuveSourceNom: cuve.nom,
      volumeOccupe: stockage.volumeOccupe,
      colorHex: stockage.lotColorHex,
    };
    setDragPayload(payload);
    setIsDragging(true);
    didDragRef.current = true;
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleLotDragStart = (e: React.DragEvent, lot: Lot) => {
    const payload: DragPayload = {
      lotId: lot.id!,
      lotIdentifiant: lot.identifiant,
      cuveSourceId: -1,
      cuveSourceNom: "Stock",
      volumeOccupe: lot.volumeActuel,
      colorHex: lot.colorHex,
      isUnassigned: true,
    };
    setDragPayload(payload);
    setIsDragging(true);
    didDragRef.current = true;
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragPayload(null);
    setDragOverCuveId(null);
    // didDragRef stays true — will be consumed by next onClick
  };

  const handleDragOver = (e: React.DragEvent, cuveId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCuveId(cuveId);
  };

  const handleDragLeave = () => {
    setDragOverCuveId(null);
  };

  const handleDrop = async (e: React.DragEvent, destCuve: Cuve) => {
    e.preventDefault();
    setDragOverCuveId(null);
    setIsDragging(false);

    try {
      const payload: DragPayload = JSON.parse(e.dataTransfer.getData("application/json"));
      if (!payload.isUnassigned && payload.cuveSourceId === destCuve.id) return;

      // UNASSIGNED LOT → REMPLISSAGE
      if (payload.isUnassigned) {
        const isPropre = destCuve.statutPhysique === "PROPRE";
        const destHasContent = (destCuve.stockages?.length || 0) > 0;
        if (!isPropre || destHasContent) return;
        await handleRemplissage(destCuve.id!, payload.lotId, payload.volumeOccupe);
        setShowLotsPopup(false);
        return;
      }

      const destHasContent = (destCuve.stockages?.length || 0) > 0;

      if (destHasContent) {
        // DROP ON FULL CUVE → ASSEMBLAGE
        const sourceCuve = cuves.find(c => c.id === payload.cuveSourceId);
        if (!sourceCuve) return;

        const lotA = lots.find(l => l.id === destCuve.stockages![0].lotId);
        const lotB = lots.find(l => l.id === payload.lotId);
        if (!lotA || !lotB) return;

        const volA = destCuve.stockages![0].volumeOccupe;
        const volB = payload.volumeOccupe;

        // Open assemblage modal
        setAssemblageSrcA({ cuve: destCuve, lot: lotA, volume: volA });
        setAssemblageSrcB({ cuve: sourceCuve, lot: lotB, volume: volB });
        setAssemblageDestCuveId(null);
        setAssemblageNewLotId("");
        setAssemblageError(null);
        setModalView("assemblage");
      } else {
        // DROP ON EMPTY CUVE → TRANSFERT
        setDragPayload(payload);
        setTargetCuve(destCuve);
        setTransferVolume(payload.volumeOccupe);
        setModalView("transfert");
      }
    } catch { /* invalid */ }
  };

  // ── Operations ────────────────────────────────────────────────────────────

  const handleTransfert = async () => {
    if (!dragPayload || !targetCuve) return;
    setModalLoading(true);
    try {
      await opTransfert(dragPayload.cuveSourceId, targetCuve.id!, dragPayload.lotId, transferVolume);
      await loadData();
      setModalView(null);
      setPanelView(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur lors du transfert");
    } finally { setModalLoading(false); }
  };

  const handleAssemblage = async () => {
    if (!assemblageSrcA || !assemblageSrcB || !assemblageDestCuveId || !assemblageNewLotId) return;
    setAssemblageError(null);

    const destCuve = cuves.find(c => c.id === assemblageDestCuveId);
    if (!destCuve) { setAssemblageError("Cuve de destination introuvable."); return; }

    const totalVolume = assemblageSrcA.volume + assemblageSrcB.volume;
    if (totalVolume > destCuve.volumeMax) {
      setAssemblageError(
        `Capacité insuffisante. Le volume total (${totalVolume.toLocaleString()} L) dépasse la capacité de ${destCuve.nom} (${destCuve.volumeMax.toLocaleString()} L).`
      );
      return;
    }

    // Determine the product type (take the first source's type)
    const typeProduit = assemblageSrcA.lot.typeProduit || assemblageSrcB.lot.typeProduit || "Assemblage";

    setModalLoading(true);
    try {
      await opAssemblage({
        sources: [
          { cuveId: assemblageSrcA.cuve.id!, lotId: assemblageSrcA.lot.id!, volume: assemblageSrcA.volume },
          { cuveId: assemblageSrcB.cuve.id!, lotId: assemblageSrcB.lot.id!, volume: assemblageSrcB.volume },
        ],
        cuveDestId: assemblageDestCuveId,
        newLotIdentifiant: assemblageNewLotId,
        typeProduit,
        colorL: assemblageSrcA.lot.colorL,
        colorA: assemblageSrcA.lot.colorA,
        colorB: assemblageSrcA.lot.colorB,
        colorHex: assemblageSrcA.lot.colorHex,
      });
      await loadData();
      setModalView(null);
      setPanelView(null);
    } catch (err: any) {
      setAssemblageError(err?.response?.data?.error || err?.response?.data?.detail || "Erreur lors de l'assemblage");
    } finally { setModalLoading(false); }
  };

  const handleNettoyage = async (cuveId: number) => {
    try {
      await opNettoyage(cuveId);
      await loadData();
      setPanelView(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    }
  };

  const handleRemplissage = async (cuveId: number, lotId: number, volume: number) => {
    try {
      await opRemplissage(cuveId, lotId, volume);
      await loadData();
      setPanelView(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    }
  };

  const handleCreateCuve = async () => {
    if (!newCuveNom) return;
    try {
      const nom = newCuveNom.startsWith("Cuve ") ? newCuveNom : `Cuve ${newCuveNom}`;

      await createCuve({ nom, volumeMax: newCuveVolume, statutPhysique: "PROPRE" });
      setNewCuveNom(""); setNewCuveVolume(1000);
      setPanelView(null);
      await loadData();
    } catch (err: any) { alert(err?.response?.data?.error || "Erreur"); }
  };

  // ── Spectrum file parsing ────────────────────────────────────────────────

  const handleSpectrumUpload = async (file: File) => {
    setSpectrumLoading(true);
    setSpectrumFileName(file.name);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n").filter(l => l.trim());
      const wavelengths: number[] = [];
      const doValues: number[] = [];

      for (const line of lines) {
        const parts = line.replace(/"/g, "").split(/[,;\t]+/).map(s => s.trim());
        if (parts.length >= 2) {
          const wl = parseFloat(parts[0].replace(",", "."));
          const dov = parseFloat(parts[1].replace(",", "."));
          if (!isNaN(wl) && !isNaN(dov)) {
            wavelengths.push(wl);
            doValues.push(dov);
          }
        }
      }

      if (wavelengths.length < 2) {
        alert("Fichier invalide : il faut au moins 2 points (longueur d'onde, DO)");
        setSpectrumLoading(false);
        return;
      }

      // Call backend to compute L*a*b* + hex
      const color = await spectrumToLab(wavelengths, doValues);
      setNewLotSpectrum({ wavelengths, do: doValues });
      setNewLotColor(color);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors du traitement du spectre");
      setNewLotSpectrum(null);
      setNewLotColor(null);
    } finally {
      setSpectrumLoading(false);
    }
  };

  const handleCreateLot = async () => {
    if (!newLotId || !newLotSpectrum || !newLotColor) return;
    try {
      await createLot({
        identifiant: newLotId,
        typeProduit: newLotType,
        volumeActuel: newLotVolume,
        statutLot: "EN_FERMENTATION",
        colorL: newLotColor.L,
        colorA: newLotColor.a,
        colorB: newLotColor.b,
        colorHex: newLotColor.hex,
        spectrumJson: JSON.stringify(newLotSpectrum),
      });
      setNewLotId(""); setNewLotType(""); setNewLotVolume(0);
      setNewLotSpectrum(null); setNewLotColor(null); setSpectrumFileName("");
      setPanelView(null);
      await loadData();
    } catch (err: any) { alert(err?.response?.data?.error || "Erreur"); }
  };

  // ── Transformation (re-upload spectrum for existing lot) ──────────────────

  const handleTransformation = async (lot: Lot, file: File) => {
    try {
      const text = await file.text();
      const lines = text.trim().split("\n").filter(l => l.trim());
      const wavelengths: number[] = [];
      const doValues: number[] = [];
      for (const line of lines) {
        const parts = line.replace(/"/g, "").split(/[,;\t]+/).map(s => s.trim());
        if (parts.length >= 2) {
          const wl = parseFloat(parts[0].replace(",", "."));
          const dov = parseFloat(parts[1].replace(",", "."));
          if (!isNaN(wl) && !isNaN(dov)) { wavelengths.push(wl); doValues.push(dov); }
        }
      }
      if (wavelengths.length < 2) { alert("Fichier spectre invalide"); return; }

      const color = await spectrumToLab(wavelengths, doValues);
      await opTransformation({
        lotId: lot.id!,
        colorL: color.L, colorA: color.a, colorB: color.b,
        colorHex: color.hex,
        spectrumJson: JSON.stringify({ wavelengths, do: doValues }),
        description: "Transformation — mise à jour du spectre",
      });
      await loadData();
      setPanelView(null);
    } catch (err: any) { alert(err?.response?.data?.detail || "Erreur transformation"); }
  };

  // ── Unassigned lots ────────────────────────────────────────────────────────
  const unassignedLots = lots.filter(l => !l.cuveActuelle);

  // ── Zone grouping ──────────────────────────────────────────────────────────
  const activeCuves = cuves.filter(c => (c.stockages?.length || 0) > 0);
  const availableCuves = cuves.filter(c => (c.stockages?.length || 0) === 0 && c.statutPhysique === "PROPRE");
  const maintenanceCuves = cuves.filter(c => (c.stockages?.length || 0) === 0 && c.statutPhysique !== "PROPRE");

  // ── Render a cuve card ─────────────────────────────────────────────────────
  const renderCuveCard = (cuve: Cuve) => {
    const volumeOccupe = cuve.volumeOccupe || 0;
    const hasContent = (cuve.stockages?.length || 0) > 0;
    const mainColor = cuve.stockages?.[0]?.lotColorHex || null;
    const mainLot = cuve.stockages?.[0]?.lotIdentifiant || null;
    const dragState = getCuveDragState(cuve);

    return (
      <div
        key={cuve.id}
        className={`relative flex flex-col items-center p-3 rounded-xl select-none transition-all duration-200 ${
          hasContent && user ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${
          selectedCuve?.id === cuve.id && panelView
            ? "bg-white ring-2 ring-indigo-300 shadow-md"
            : "hover:bg-white/80 hover:shadow-sm"
        }`}
        onPointerDown={handlePointerDown}
        onClick={() => handleCuveClick(cuve)}
        draggable={!!user && hasContent}
        onDragStart={(e) => handleDragStart(e, cuve)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, cuve.id!)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, cuve)}
      >
        <CuveSVG
          nom={cuve.nom}
          volumeMax={cuve.volumeMax}
          volumeOccupe={volumeOccupe}
          colorHex={mainColor}
          statutPhysique={cuve.statutPhysique || "PROPRE"}
          lotIdentifiant={mainLot}
          dragState={dragState}
          isSelected={selectedCuve?.id === cuve.id && !!panelView}
          width={100}
          height={155}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F5F5F5" }}>
      {/* ── Main Canvas ──────────────────────────────────────────────────── */}
      <div className={`flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300 ${panelView ? "mr-[380px]" : ""}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Container className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Chai Virtuel</h1>
                <p className="text-xs text-gray-400">{cuves.length} cuves · {lots.length} lots</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <button onClick={() => setPanelView("create-lot")}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all shadow-sm">
                    <FlaskConical className="w-3.5 h-3.5" /> Lot
                  </button>
                  <button onClick={() => setPanelView("create-cuve")}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 shadow-sm transition-all">
                    <Plus className="w-3.5 h-3.5" /> Cuve
                  </button>
                </>
              )}
              <button onClick={loadData}
                className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all shadow-sm">
                <RefreshCw className="w-4 h-4" />
              </button>
              {unassignedLots.length > 0 && (
                <button onClick={() => setShowLotsPopup(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all shadow-sm ${
                    showLotsPopup
                      ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}>
                  <PackageOpen className="w-3.5 h-3.5" />
                  <span>{unassignedLots.length}</span>
                </button>
              )}
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-gray-300" /></div>
          ) : (
            <div className="space-y-6">
              {/* Instruction hint during drag */}
              {isDragging && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium animate-in fade-in duration-200">
                  <ArrowRight className="w-4 h-4" />
                  <span>Déposez sur une <strong>cuve vide</strong> pour transférer, ou sur une <strong>cuve pleine</strong> pour assembler</span>
                </div>
              )}

              {/* ── Zone : Cuves en activité ───────────────────────────────── */}
              {activeCuves.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Grape className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Cuves en activité</h2>
                      <p className="text-[10px] text-gray-400">{activeCuves.length} cuve{activeCuves.length > 1 ? "s" : ""} contenant un lot</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {activeCuves.map(renderCuveCard)}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Zone : Cuves disponibles ───────────────────────────────── */}
              {availableCuves.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                      <Archive className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Cuves disponibles</h2>
                      <p className="text-[10px] text-gray-400">{availableCuves.length} cuve{availableCuves.length > 1 ? "s" : ""} propre{availableCuves.length > 1 ? "s" : ""} et vide{availableCuves.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {availableCuves.map(renderCuveCard)}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Zone : Cuves en maintenance ────────────────────────────── */}
              {maintenanceCuves.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Cuves en maintenance</h2>
                      <p className="text-[10px] text-gray-400">{maintenanceCuves.length} cuve{maintenanceCuves.length > 1 ? "s" : ""} à nettoyer ou en réparation</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {maintenanceCuves.map(renderCuveCard)}
                    </div>
                  </div>
                </section>
              )}


            </div>
          )}
        </div>
      </div>

      {/* ── Floating Lots Popup ──────────────────────────────────────────── */}
      {showLotsPopup && unassignedLots.length > 0 && (
        <div className={`fixed bottom-6 z-40 w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300 transition-all ${panelView ? "right-[400px]" : "right-6"}`}>
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                <PackageOpen className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900">Lots en attente</h3>
                <p className="text-[9px] text-gray-400">{unassignedLots.length} lot{unassignedLots.length > 1 ? "s" : ""} — glissez vers une cuve</p>
              </div>
            </div>
            <button onClick={() => setShowLotsPopup(false)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-lg transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Lot list */}
          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {unassignedLots.map((lot) => (
              <div
                key={lot.id}
                draggable
                onDragStart={(e) => handleLotDragStart(e, lot)}
                onDragEnd={handleDragEnd}
                onClick={() => { setSelectedLot(lot); setSelectedCuve(null); setPanelView("lot-detail"); }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-indigo-50 hover:border-indigo-200 cursor-grab active:cursor-grabbing transition-all group"
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                {lot.colorHex ? (
                  <div className="w-3 h-8 rounded-full shrink-0 shadow-inner" style={{ backgroundColor: lot.colorHex }} />
                ) : (
                  <div className="w-3 h-8 rounded-full shrink-0 bg-gray-200" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-mono font-bold text-gray-700 truncate">{lot.identifiant}</p>
                  <p className="text-[9px] text-gray-400">{lot.volumeActuel?.toLocaleString()} L · {lot.typeProduit}</p>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Side Panel ───────────────────────────────────────────────────── */}
      {panelView && (
        <aside className="fixed right-0 top-0 bottom-0 w-[380px] bg-white border-l border-gray-100 shadow-xl overflow-y-auto z-30 animate-in slide-in-from-right duration-300">
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
            <h2 className="font-bold text-sm text-gray-900">
              {panelView === "lot-detail" && "Fiche du Lot"}
              {panelView === "cuve-status" && "État de la Cuve"}
              {panelView === "create-cuve" && "Nouvelle Cuve"}
              {panelView === "create-lot" && "Nouveau Lot"}
            </h2>
            <button onClick={() => { setPanelView(null); setSelectedCuve(null); setSelectedLot(null); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">
            {/* ── LOT DETAIL ─────────────────────────────────────────── */}
            {panelView === "lot-detail" && selectedLot && (
              <div className="space-y-5">
                {/* Color preview */}
                {selectedLot.colorHex && (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border border-black/5 shadow-inner"
                      style={{ backgroundColor: selectedLot.colorHex }} />
                    <div>
                      <p className="text-xs text-gray-400 font-mono">
                        L*{selectedLot.colorL?.toFixed(1)} a*{selectedLot.colorA?.toFixed(1)} b*{selectedLot.colorB?.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-gray-300 font-mono">{selectedLot.colorHex}</p>
                    </div>
                  </div>
                )}

                {/* Identity */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-indigo-400" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Identifiant</p>
                      <p className="text-sm font-mono font-bold text-gray-900">{selectedLot.identifiant}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Type</p>
                      <p className="text-xs font-bold text-gray-700">{selectedLot.typeProduit || "—"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Volume</p>
                      <p className="text-xs font-bold text-gray-700">{selectedLot.volumeActuel?.toLocaleString()} L</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Statut</p>
                      <p className="text-xs font-bold text-gray-700">{selectedLot.statutLot?.replace(/_/g, " ") || "—"}</p>
                    </div>
                    {selectedCuve && (
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Cuve</p>
                        <p className="text-xs font-bold text-indigo-600">{selectedCuve.nom}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Spectrum mini chart placeholder */}
                {selectedLot.spectrumJson && (
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                      <p className="text-[10px] font-bold text-indigo-700 uppercase">Spectre d&apos;absorption</p>
                    </div>
                    <div className="h-16 flex items-end gap-px">
                      {(() => {
                        try {
                          const data = JSON.parse(selectedLot.spectrumJson!);
                          const doVals: number[] = data.do || [];
                          const max = Math.max(...doVals, 0.01);
                          const step = Math.max(1, Math.floor(doVals.length / 40));
                          return doVals.filter((_: number, i: number) => i % step === 0).map((v: number, i: number) => (
                            <div key={i} className="flex-1 bg-indigo-400/60 rounded-t-sm"
                              style={{ height: `${(v / max) * 100}%` }} />
                          ));
                        } catch { return <p className="text-[9px] text-gray-400">Données disponibles</p>; }
                      })()}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <Calendar className="w-3 h-3" />
                  <span>Créé le {selectedLot.createdAt ? new Date(selectedLot.createdAt).toLocaleDateString("fr") : "—"}</span>
                </div>

                {/* Operations on this lot */}
                {user && (
                  <div className="space-y-2 pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Opérations</p>

                    {/* Transformation: re-upload spectrum */}
                    <label className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-xl text-sm hover:bg-amber-100 cursor-pointer transition-all">
                      <Palette className="w-4 h-4" />
                      <span>Transformation (nouveau spectre)</span>
                      <input type="file" accept=".csv,.txt,.tsv" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && selectedLot) handleTransformation(selectedLot, f);
                        }} />
                    </label>
                    <p className="text-[9px] text-gray-400 px-1">
                      Ex: centrifugation, filtration — la couleur du lot sera recalculée à partir du nouveau spectre.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── CUVE STATUS (empty cuve) ───────────────────────────── */}
            {panelView === "cuve-status" && selectedCuve && (
              <div className="space-y-5">
                <div className="text-center py-4">
                  <CuveSVG
                    nom={selectedCuve.nom}
                    volumeMax={selectedCuve.volumeMax}
                    volumeOccupe={0}
                    statutPhysique={selectedCuve.statutPhysique || "PROPRE"}
                    colorHex={null}
                    width={120}
                    height={180}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Capacité</p>
                    <p className="text-sm font-bold text-gray-700">{selectedCuve.volumeMax?.toLocaleString()} L</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Statut</p>
                    <p className={`text-sm font-bold ${
                      selectedCuve.statutPhysique === "PROPRE" ? "text-green-600" :
                      selectedCuve.statutPhysique === "SALE" ? "text-red-500" : "text-amber-500"
                    }`}>{selectedCuve.statutPhysique}</p>
                  </div>
                </div>

                {/* Actions */}
                {user && (
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</p>

                    {selectedCuve.statutPhysique === "SALE" && (
                      <button onClick={() => handleNettoyage(selectedCuve.id!)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 text-green-700 font-bold rounded-xl text-sm hover:bg-green-100 transition-all">
                        <Sparkles className="w-4 h-4" /> Nettoyer cette cuve
                      </button>
                    )}

                    {selectedCuve.statutPhysique === "PROPRE" && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500">Cette cuve est prête à recevoir un lot :</p>
                        <select
                          onChange={(e) => {
                            const lotId = parseInt(e.target.value);
                            if (!lotId) return;
                            const lot = unassignedLots.find(l => l.id === lotId);
                            if (lot && selectedCuve.id) {
                              handleRemplissage(selectedCuve.id, lotId, lot.volumeActuel);
                            }
                          }}
                          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>Affecter un lot...</option>
                          {unassignedLots.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.identifiant} ({l.volumeActuel}L)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── CREATE CUVE ────────────────────────────────────────── */}
            {panelView === "create-cuve" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Nom de la cuve</label>
                  <input type="text" value={newCuveNom} onChange={(e) => setNewCuveNom(e.target.value)}
                    placeholder="ex: A → Cuve A"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 outline-none" />
                  <p className="text-[10px] text-gray-400 mt-1">{"Le système ajoutera automatiquement le préfixe \"Cuve \""}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Volume max (L)</label>
                  <input type="number" value={newCuveVolume} onChange={(e) => setNewCuveVolume(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <button onClick={handleCreateCuve} disabled={!newCuveNom}
                  className="w-full px-4 py-2.5 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-all">
                  Créer la cuve
                </button>
              </div>
            )}

            {/* ── CREATE LOT ─────────────────────────────────────────── */}
            {panelView === "create-lot" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Identifiant</label>
                  <input type="text" value={newLotId} onChange={(e) => setNewLotId(e.target.value)}
                    placeholder="ex: LOT-2026-POM-01"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Type de produit</label>
                  <select value={newLotType} onChange={(e) => setNewLotType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 outline-none">
                    <option value="">Sélectionner...</option>
                    {["Jus de pomme", "Moût", "Cidre doux", "Cidre demi-sec", "Cidre brut", "Cidre extra-brut"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Volume (L)</label>
                  <input type="number" value={newLotVolume} onChange={(e) => setNewLotVolume(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>

                {/* Spectrum upload (MANDATORY) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Spectre d&apos;absorption <span className="text-red-400">*</span>
                  </label>
                  <label className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    newLotColor ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                  }`}>
                    <Upload className={`w-5 h-5 ${newLotColor ? "text-green-500" : "text-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      {spectrumLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                          <span className="text-xs text-indigo-600">Calcul de la couleur...</span>
                        </div>
                      ) : spectrumFileName ? (
                        <p className="text-xs font-mono text-gray-700 truncate">{spectrumFileName}</p>
                      ) : (
                        <p className="text-xs text-gray-400">CSV : longueur d&apos;onde (nm) ; DO</p>
                      )}
                    </div>
                    <input type="file" accept=".csv,.txt,.tsv" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSpectrumUpload(f);
                      }} />
                  </label>
                </div>

                {/* Color preview from spectrum */}
                {newLotColor && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-10 h-10 rounded-xl shadow-inner border border-black/5"
                      style={{ backgroundColor: newLotColor.hex }} />
                    <div>
                      <p className="text-[10px] text-gray-400 font-mono">
                        L*{newLotColor.L.toFixed(1)} a*{newLotColor.a.toFixed(1)} b*{newLotColor.b.toFixed(1)}
                      </p>
                      <p className="text-xs font-bold text-gray-700">{newLotColor.hex}</p>
                    </div>
                    <Palette className="w-4 h-4 text-indigo-400 ml-auto" />
                  </div>
                )}

                <button onClick={handleCreateLot} disabled={!newLotId || !newLotVolume || !newLotColor}
                  className="w-full px-4 py-2.5 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-all">
                  {!newLotColor ? "Spectre requis pour créer" : "Créer le lot"}
                </button>
                {!newLotColor && newLotId && (
                  <p className="text-[10px] text-amber-600 text-center">Uploadez le spectre d&apos;absorption pour calculer la couleur du lot</p>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Transfer Modal (overlay) ─────────────────────────────────────── */}
      {modalView === "transfert" && dragPayload && targetCuve && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-blue-500" /> Transfert
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-mono font-bold">{dragPayload.lotIdentifiant}</span> : {dragPayload.cuveSourceNom} → {targetCuve.nom}
              </p>
            </header>
            <div className="p-6 space-y-4">
              {/* Visual preview */}
              <div className="flex items-center justify-center gap-4 py-3">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full mx-auto mb-1 border-2 border-red-200"
                    style={{ backgroundColor: dragPayload.colorHex || "#d4a574" }} />
                  <p className="text-[9px] text-gray-400">{dragPayload.cuveSourceNom}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-300" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full mx-auto mb-1 border-2 border-dashed border-green-300 bg-green-50" />
                  <p className="text-[9px] text-gray-400">{targetCuve.nom}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Volume à transférer (L)</label>
                <input type="range" min={1} max={dragPayload.volumeOccupe} value={transferVolume}
                  onChange={(e) => setTransferVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500" />
                <div className="flex justify-between mt-2">
                  <input type="number" value={transferVolume} max={dragPayload.volumeOccupe}
                    onChange={(e) => setTransferVolume(Math.min(dragPayload.volumeOccupe, parseFloat(e.target.value) || 0))}
                    className="w-24 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-center focus:ring-2 focus:ring-blue-200 outline-none" />
                  <span className="text-[10px] text-gray-400 self-center">/ {dragPayload.volumeOccupe} L max</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalView(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all">
                  Annuler
                </button>
                <button onClick={handleTransfert} disabled={modalLoading || transferVolume <= 0}
                  className="flex-1 px-4 py-2.5 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all">
                  {modalLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Transférer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assemblage Modal (overlay) ─────────────────────────────────────── */}
      {modalView === "assemblage" && assemblageSrcA && assemblageSrcB && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Blend className="w-5 h-5 text-purple-500" /> Créer un assemblage
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Mélange de <span className="font-mono font-bold">{assemblageSrcA.lot.identifiant}</span> ({assemblageSrcA.volume.toLocaleString()} L) + <span className="font-mono font-bold">{assemblageSrcB.lot.identifiant}</span> ({assemblageSrcB.volume.toLocaleString()} L)
              </p>
            </header>
            <div className="p-6 space-y-4">
              {/* Source lots preview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">Source A</p>
                  <p className="text-xs font-mono font-bold text-gray-700">{assemblageSrcA.lot.identifiant}</p>
                  <p className="text-[10px] text-gray-500">{assemblageSrcA.cuve.nom} · {assemblageSrcA.volume.toLocaleString()} L</p>
                  {assemblageSrcA.lot.colorHex && (
                    <div className="mt-2 w-full h-3 rounded-full" style={{ backgroundColor: assemblageSrcA.lot.colorHex }} />
                  )}
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">Source B</p>
                  <p className="text-xs font-mono font-bold text-gray-700">{assemblageSrcB.lot.identifiant}</p>
                  <p className="text-[10px] text-gray-500">{assemblageSrcB.cuve.nom} · {assemblageSrcB.volume.toLocaleString()} L</p>
                  {assemblageSrcB.lot.colorHex && (
                    <div className="mt-2 w-full h-3 rounded-full" style={{ backgroundColor: assemblageSrcB.lot.colorHex }} />
                  )}
                </div>
              </div>

              {/* Destination cuve selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Cuve de réception <span className="text-red-400">*</span>
                </label>
                <select
                  value={assemblageDestCuveId || ""}
                  onChange={(e) => setAssemblageDestCuveId(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                >
                  <option value="">Sélectionner une cuve vide et propre...</option>
                  {cuves
                    .filter(c => c.statutPhysique === "PROPRE" && (c.stockages?.length || 0) === 0)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nom} (capacité: {c.volumeMax.toLocaleString()} L)
                      </option>
                    ))}
                </select>
                {assemblageDestCuveId && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Volume total: {(assemblageSrcA.volume + assemblageSrcB.volume).toLocaleString()} L
                  </p>
                )}
              </div>

              {/* New lot identifier */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Identifiant du nouveau lot <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={assemblageNewLotId}
                  onChange={(e) => setAssemblageNewLotId(e.target.value)}
                  placeholder="ex: ASM-2026-POM-01"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-purple-200 outline-none"
                />
              </div>

              {/* Error message */}
              {assemblageError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{assemblageError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalView(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all">
                  Annuler
                </button>
                <button onClick={handleAssemblage} disabled={modalLoading || !assemblageDestCuveId || !assemblageNewLotId}
                  className="flex-1 px-4 py-2.5 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all">
                  {modalLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Assembler"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
