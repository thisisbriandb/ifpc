"use client";

import { useMemo } from "react";

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
  width = 100,
  height = 160,
}: CuveSVGProps) {
  const fillPct = useMemo(() => Math.min(100, Math.max(0, (volumeOccupe / volumeMax) * 100)), [volumeOccupe, volumeMax]);

  const liquidColor = colorHex || "#d4a574";
  const isEmpty = fillPct === 0;
  const isPropre = statutPhysique === "PROPRE";
  const isSale = statutPhysique === "SALE";

  // Tank body geometry (relative to viewbox 0 0 100 160)
  const bodyTop = 28;
  const bodyBottom = 132;
  const bodyHeight = bodyBottom - bodyTop;
  const liquidHeight = (fillPct / 100) * bodyHeight;
  const liquidY = bodyBottom - liquidHeight;

  // Visual states
  const outlineColor = useMemo(() => {
    if (dragState === "valid-target") return "#22c55e";
    if (dragState === "drag-over") return "#3b82f6";
    if (dragState === "invalid-target") return "#d1d5db";
    if (isSelected) return "#6366f1";
    if (isSale) return "#ef4444";
    if (isEmpty && isPropre) return "#d1d5db";
    return "#e2e8f0";
  }, [dragState, isSelected, isEmpty, isPropre, isSale]);

  const outlineDash = (isEmpty && isPropre && dragState === "idle") ? "4 3" : "none";
  const outlineWidth = dragState === "drag-over" || dragState === "valid-target" || isSelected ? 2.5 : 1.5;
  const bodyOpacity = dragState === "invalid-target" ? 0.4 : dragState === "dragging" ? 0.5 : 1;

  return (
    <svg
      viewBox="0 0 100 155"
      width={width}
      height={height}
      className={`transition-all duration-300 select-none ${dragState === "drag-over" ? "scale-105" : ""}`}
      style={{ opacity: bodyOpacity }}
    >
      {/* Glow for valid targets */}
      {dragState === "valid-target" && (
        <rect x="12" y="24" width="76" height={bodyHeight + 12} rx="9" ry="9"
          fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.6">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Drop zone highlight */}
      {dragState === "drag-over" && (
        <rect x="10" y="22" width="80" height={bodyHeight + 16} rx="10" ry="10"
          fill="#3b82f6" opacity="0.08" />
      )}

      {/* Tank body */}
      <rect x="18" y={bodyTop} width="64" height={bodyHeight} rx="6" ry="6"
        fill={isEmpty ? (isPropre ? "#fafafa" : "#fef2f2") : "#f8fafc"}
        stroke={outlineColor}
        strokeWidth={outlineWidth}
        strokeDasharray={outlineDash} />

      {/* Liquid fill with gradient */}
      {!isEmpty && (
        <>
          <defs>
            <linearGradient id={`liquid-${nom}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={liquidColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={liquidColor} stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <rect x="19" y={liquidY} width="62" height={liquidHeight} rx="5" ry="5"
            fill={`url(#liquid-${nom})`}>
            <animate attributeName="opacity" values="0.85;0.95;0.85" dur="5s" repeatCount="indefinite" />
          </rect>
          {/* Surface shimmer */}
          <rect x="25" y={liquidY} width="50" height="2" rx="1"
            fill="white" opacity="0.25" />
        </>
      )}

      {/* Tank top cap */}
      <ellipse cx="50" cy={bodyTop} rx="32" ry="5"
        fill={isEmpty ? "#f9fafb" : "#f1f5f9"} stroke={outlineColor} strokeWidth="1.2" />

      {/* Valve */}
      <rect x="45" y="14" width="10" height="16" rx="3" fill="#94a3b8" />
      <rect x="41" y="11" width="18" height="5" rx="2" fill="#64748b" />

      {/* Legs */}
      <rect x="24" y={bodyBottom} width="3" height="12" rx="1" fill="#94a3b8" />
      <rect x="73" y={bodyBottom} width="3" height="12" rx="1" fill="#94a3b8" />
      <rect x="20" y="143" width="11" height="3" rx="1" fill="#94a3b8" />
      <rect x="69" y="143" width="11" height="3" rx="1" fill="#94a3b8" />

      {/* Status badge (sale = red X, propre = green check) */}
      {isEmpty && isSale && (
        <g transform="translate(72, 32)">
          <circle r="6" fill="#fef2f2" stroke="#ef4444" strokeWidth="1" />
          <text textAnchor="middle" y="3" fontSize="8" fill="#ef4444" fontWeight="bold">!</text>
        </g>
      )}
      {isEmpty && isPropre && (
        <g transform="translate(72, 32)">
          <circle r="6" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1" />
          <text textAnchor="middle" y="3.5" fontSize="7" fill="#22c55e">✓</text>
        </g>
      )}

      {/* Lot badge (macaron) */}
      {!isEmpty && lotIdentifiant && (
        <g>
          <rect x="20" y={bodyBottom - 22} width="60" height="16" rx="8" fill="white" fillOpacity="0.92" stroke={liquidColor} strokeWidth="0.8" />
          <text x="50" y={bodyBottom - 11} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#374151" fontFamily="monospace">
            {lotIdentifiant.length > 10 ? lotIdentifiant.substring(0, 9) + "…" : lotIdentifiant}
          </text>
        </g>
      )}

      {/* Volume indicator */}
      {!isEmpty && (
        <text x="50" y={bodyBottom + 2} textAnchor="middle" fontSize="6" fill="#6b7280" fontFamily="monospace">
          {volumeOccupe.toLocaleString()}L / {volumeMax.toLocaleString()}L
        </text>
      )}

      {/* Tank name */}
      <text x="50" y="153" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#374151" fontFamily="system-ui">
        {nom.length > 10 ? nom.substring(0, 9) + "…" : nom}
      </text>
    </svg>
  );
}
