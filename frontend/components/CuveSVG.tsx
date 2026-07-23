"use client";

import { useMemo } from "react";
import Image from "next/image";

export type CuveDragState = "idle" | "valid-target" | "invalid-target" | "drag-over" | "dragging";

interface CuveSVGProps {
  nom: string;
  volumeMax: number;
  volumeOccupe: number;
  colorHex?: string | null;
  statutPhysique: string;
  lotIdentifiant?: string | null;
  dragState?: CuveDragState;
  isSelected?: boolean;
  width?: number;
  height?: number;
}

export default function CuveSVG({
  nom,
  volumeMax,
  volumeOccupe,
  colorHex,
  statutPhysique,
  lotIdentifiant,
  dragState = "idle",
  isSelected = false,
  width = 130,
  height = 220,
}: CuveSVGProps) {
  const fillPct = useMemo(() => Math.min(100, Math.max(0, (volumeOccupe / volumeMax) * 100)), [volumeOccupe, volumeMax]);

  const liquidColor = colorHex || "#d4a574";

  // Build a cylindrical gradient (darker edges, vivid center) for 3D volume illusion
  const liquidGradient = useMemo(() => {
    const hex = liquidColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `linear-gradient(90deg, rgba(${r},${g},${b},0.7) 0%, rgba(${r},${g},${b},0.95) 50%, rgba(${r},${g},${b},0.7) 100%)`;
  }, [liquidColor]);

  const isEmpty = fillPct === 0;
  const isPropre = statutPhysique === "PROPRE";
  const isSale = statutPhysique === "SALE";

  // Liquid zone positioning (% of container height)
  // Based on cropped image: body starts at ~28% from top, ends at ~77%
  const liquidZoneTop = 28;
  const liquidZoneBottom = 77;
  const liquidZoneHeight = liquidZoneBottom - liquidZoneTop; // 49% of image height
  const liquidHeightPct = (fillPct / 100) * liquidZoneHeight;
  const liquidBottomPos = 100 - liquidZoneBottom; // 23% from container bottom

  // Visual states for ring/glow (no red border for SALE — handled via grayscale filter)
  const ringClass = useMemo(() => {
    if (dragState === "valid-target") return "ring-2 ring-green-400 ring-offset-2";
    if (dragState === "drag-over") return "ring-2 ring-blue-400 ring-offset-2 scale-105";
    if (dragState === "invalid-target") return "opacity-40";
    if (isSelected) return "ring-2 ring-indigo-400 ring-offset-2";
    return "";
  }, [dragState, isSelected]);

  // Grayscale filter on the tank image when SALE (out of service)
  const imageFilter = isSale && isEmpty ? "grayscale(100%) brightness(0.95)" : "none";

  const containerOpacity = dragState === "invalid-target" ? 0.4 : dragState === "dragging" ? 0.5 : 1;

  return (
    <div
      className={`relative select-none transition-all duration-300 rounded-xl ${ringClass}`}
      style={{ width, height, opacity: containerOpacity }}
    >
      {/* BASE — Tank image (z-10) */}
      <Image
        src="/assets/cuve-overlay.png"
        alt={nom}
        fill
        className="object-contain z-10 pointer-events-none drop-shadow-xl transition-[filter] duration-300"
        sizes="200px"
        priority
        style={{ filter: imageFilter }}
      />

      {/* LIQUID — 3D illusion: elliptical surface + cylindrical gradient + multi-blend */}
      {!isEmpty && (
        <>
          {/* Layer 1: multiply — preserves metal shadows + cylindrical gradient */}
          <div
            className="absolute z-20 pointer-events-none transition-all duration-500 ease-in-out"
            style={{
              bottom: `${liquidBottomPos}%`,
              left: "14%",
              right: "14%",
              height: `${liquidHeightPct}%`,
              background: liquidGradient,
              mixBlendMode: "multiply",
              borderRadius: "50% / 10px",
              boxShadow: "inset 0 -10px 20px rgba(0,0,0,0.35), inset 0 6px 12px rgba(0,0,0,0.15)",
            }}
          />
          {/* Layer 2: hard-light — boosts saturation and vividness */}
          <div
            className="absolute z-20 pointer-events-none transition-all duration-500 ease-in-out"
            style={{
              bottom: `${liquidBottomPos}%`,
              left: "14%",
              right: "14%",
              height: `${liquidHeightPct}%`,
              background: liquidGradient,
              mixBlendMode: "hard-light",
              opacity: 0.55,
              borderRadius: "50% / 10px",
            }}
          />
        </>
      )}

      {/* GLOW for valid drop targets */}
      {dragState === "valid-target" && (
        <div className="absolute inset-0 z-25 rounded-xl border-2 border-green-400 animate-pulse" />
      )}

      {/* TANK NAME — on the metal label plate zone */}
      <div
        className="absolute z-30 flex items-center justify-center pointer-events-none"
        style={{ top: "33%", left: "28%", width: "42%", height: "12%" }}
      >
        <span className="text-[10px] sm:text-[11px] font-extrabold text-gray-700 tracking-tight truncate leading-none">
          {nom.length > 10 ? nom.substring(0, 9) + "…" : nom}
        </span>
      </div>

      {/* LOT — 3D embossed engraved on metal */}
      {!isEmpty && lotIdentifiant && (
        <div
          className="absolute z-30 flex items-center justify-center pointer-events-none"
          style={{ top: "46%", left: "20%", width: "60%" }}
        >
          <span
            className="text-[9px] font-bold font-mono tracking-wider uppercase truncate"
            style={{
              color: "rgba(60, 60, 60, 0.8)",
              textShadow: "1px 1px 0px rgba(255,255,255,0.5), -1px -1px 0px rgba(0,0,0,0.2)",
            }}
          >
            {lotIdentifiant.length > 12 ? lotIdentifiant.substring(0, 11) + "…" : lotIdentifiant}
          </span>
        </div>
      )}

      {/* VOLUME / FILL % — glassmorphism for readability over any color */}
      {!isEmpty && (
        <div
          className="absolute bottom-[27%] left-1/2 -translate-x-1/2 z-30 text-center px-2 py-1 rounded-md"
          style={{
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          <div className="text-white font-extrabold text-xs sm:text-sm font-mono leading-none">
            {Math.round(fillPct)}%
          </div>
          <div className="text-[8px] text-white/90 font-bold font-mono leading-none mt-0.5">
            {volumeOccupe.toLocaleString()} hl
          </div>
        </div>
      )}

      {/* STATUS BADGES — wrench for SALE (out-of-service), check for PROPRE */}
      {isEmpty && isSale && (
        <div
          className="absolute top-1 right-1 z-30 w-7 h-7 rounded-full bg-white border-2 border-red-500 flex items-center justify-center shadow-lg"
          title="Cuve sale — nettoyage requis"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
      )}
      {isEmpty && isPropre && (
        <div className="absolute top-2 right-2 z-30 w-5 h-5 rounded-full bg-green-50 border border-green-400 flex items-center justify-center shadow-md">
          <span className="text-[10px] text-green-600">✓</span>
        </div>
      )}

      {/* EMPTY STATE */}
      {isEmpty && (
        <div className="absolute bottom-[27%] left-1/2 -translate-x-1/2 z-30 text-center">
          <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">
            {isPropre ? "Vide" : "Sale"}
          </div>
        </div>
      )}
    </div>
  );
}
