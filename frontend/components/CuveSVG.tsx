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
  width = 120,
  height = 200,
}: CuveSVGProps) {
  const fillPct = useMemo(() => Math.min(100, Math.max(0, (volumeOccupe / volumeMax) * 100)), [volumeOccupe, volumeMax]);

  const safeId = useMemo(() => nom.replace(/[^a-zA-Z0-9-_]/g, ""), [nom]);

  const liquidColor = colorHex || "#d4a574";
  const isEmpty = fillPct === 0;
  const isPropre = statutPhysique === "PROPRE";
  const isSale = statutPhysique === "SALE";

  // Tank body geometry (viewBox 0 0 200 340)
  const bodyX = 20;
  const bodyW = 160;
  const bodyTop = 60;
  const bodyBottom = 260;
  const bodyHeight = bodyBottom - bodyTop; // 200
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
    return "none";
  }, [dragState, isSelected, isEmpty, isPropre, isSale]);

  const outlineWidth = dragState === "drag-over" || dragState === "valid-target" || isSelected ? 4 : isSale ? 3 : 0;
  const bodyOpacity = dragState === "invalid-target" ? 0.4 : dragState === "dragging" ? 0.5 : 1;

  return (
    <svg
      viewBox="0 0 200 340"
      width={width}
      height={height}
      className={`transition-all duration-300 select-none ${dragState === "drag-over" ? "scale-105" : ""}`}
      style={{ opacity: bodyOpacity }}
    >
      <defs>
        {/* Metallic body gradient */}
        <linearGradient id={`metal-body-${safeId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9CA3AF" />
          <stop offset="15%" stopColor="#E5E7EB" />
          <stop offset="50%" stopColor="#F3F4F6" />
          <stop offset="85%" stopColor="#D1D5DB" />
          <stop offset="100%" stopColor="#6B7280" />
        </linearGradient>
        {/* Dome gradient */}
        <linearGradient id={`metal-dome-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D1D5DB" />
          <stop offset="100%" stopColor="#9CA3AF" />
        </linearGradient>
        {/* Liquid gradient */}
        <linearGradient id={`liquid-${safeId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={liquidColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor={liquidColor} stopOpacity="0.7" />
        </linearGradient>
        {/* Clip for liquid inside the body */}
        <clipPath id={`body-clip-${safeId}`}>
          <rect x={bodyX + 1} y={bodyTop} width={bodyW - 2} height={bodyHeight} />
        </clipPath>
      </defs>

      {/* Glow for valid targets */}
      {dragState === "valid-target" && (
        <rect x="10" y="50" width="180" height="220" rx="12"
          fill="none" stroke="#22c55e" strokeWidth="4" opacity="0.6">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Drop zone highlight */}
      {dragState === "drag-over" && (
        <rect x="8" y="48" width="184" height="224" rx="14"
          fill="#3b82f6" opacity="0.08" />
      )}

      {/* LEGS */}
      <path d="M 45 260 L 40 300 L 55 300 L 55 260 Z" fill={`url(#metal-body-${safeId})`} />
      <path d="M 155 260 L 145 300 L 160 300 L 155 260 Z" fill={`url(#metal-body-${safeId})`} />
      <path d="M 100 270 L 95 310 L 105 310 L 100 270 Z" fill="#6B7280" />

      {/* LIQUID FILL (rendered before body so it shows through) */}
      {!isEmpty && (
        <g clipPath={`url(#body-clip-${safeId})`}>
          <rect x={bodyX + 1} y={liquidY} width={bodyW - 2} height={liquidHeight}
            fill={`url(#liquid-${safeId})`}>
            <animate attributeName="opacity" values="0.75;0.9;0.75" dur="5s" repeatCount="indefinite" />
          </rect>
          {/* Surface shimmer */}
          <rect x={bodyX + 20} y={liquidY} width={bodyW - 40} height="3" rx="1.5"
            fill="white" opacity="0.3" />
        </g>
      )}

      {/* BODY (semi-transparent to see liquid) */}
      <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyHeight}
        fill={isEmpty ? (isPropre ? "#fafafa" : "#fef2f2") : `url(#metal-body-${safeId})`}
        opacity={isEmpty ? 1 : 0.85}
        stroke={outlineColor}
        strokeWidth={outlineWidth} />

      {/* TOP DOME */}
      <ellipse cx="100" cy={bodyTop} rx="80" ry="20"
        fill={`url(#metal-dome-${safeId})`}
        stroke={outlineColor} strokeWidth={outlineWidth > 0 ? outlineWidth * 0.6 : 0} />

      {/* TOP CAP / BOUCHON */}
      <rect x="85" y="30" width="30" height="15" fill={`url(#metal-body-${safeId})`} rx="2" />
      <ellipse cx="100" cy="30" rx="15" ry="4" fill="#F3F4F6" />

      {/* BOTTOM ELLIPSE */}
      <ellipse cx="100" cy={bodyBottom} rx="80" ry="25"
        fill={`url(#metal-dome-${safeId})`}
        stroke={outlineColor} strokeWidth={outlineWidth > 0 ? outlineWidth * 0.6 : 0} />

      {/* DRAIN VALVE */}
      <rect x="90" y="275" width="20" height="15" fill={`url(#metal-body-${safeId})`} rx="2" />
      <circle cx="100" cy="290" r="6" fill="#1F2937" />

      {/* MANHOLE / TRAPPE */}
      <circle cx="100" cy="220" r="22" fill="none" stroke={`url(#metal-body-${safeId})`} strokeWidth="4" />
      <circle cx="100" cy="220" r="18" fill="#F3F4F6" opacity="0.9" />
      <line x1="100" y1="198" x2="100" y2="242" stroke="#9CA3AF" strokeWidth="3" />
      <line x1="78" y1="220" x2="122" y2="220" stroke="#9CA3AF" strokeWidth="3" />
      <circle cx="100" cy="220" r="4" fill="#6B7280" />

      {/* SIDE VALVE */}
      <rect x="145" y="210" width="5" height="15" fill="#D1D5DB" />
      <rect x="140" y="220" width="15" height="4" fill="#9CA3AF" />
      <circle cx="147" cy="210" r="3" fill="#6B7280" />

      {/* STATUS BADGE (sale/propre) */}
      {isEmpty && isSale && (
        <g transform="translate(170, 70)">
          <circle r="12" fill="#fef2f2" stroke="#ef4444" strokeWidth="2" />
          <text textAnchor="middle" y="5" fontSize="14" fill="#ef4444" fontWeight="bold">!</text>
        </g>
      )}
      {isEmpty && isPropre && (
        <g transform="translate(170, 70)">
          <circle r="12" fill="#f0fdf4" stroke="#22c55e" strokeWidth="2" />
          <text textAnchor="middle" y="5" fontSize="12" fill="#22c55e">✓</text>
        </g>
      )}

      {/* LABEL / ÉTIQUETTE */}
      <rect x="50" y="95" width="100" height="34" fill="#FFFFFF" rx="6" stroke="#9CA3AF" strokeWidth="1" />
      <text x="100" y="117" fontFamily="sans-serif" fontSize="13" fontWeight="bold" fill="#1F2937" textAnchor="middle">
        {nom.length > 12 ? nom.substring(0, 11) + "…" : nom}
      </text>

      {/* LOT BADGE */}
      {!isEmpty && lotIdentifiant && (
        <g>
          <rect x="40" y="140" width="120" height="26" rx="13" fill="white" fillOpacity="0.95" stroke={liquidColor} strokeWidth="1.5" />
          <text x="100" y="158" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#374151" fontFamily="monospace">
            {lotIdentifiant.length > 14 ? lotIdentifiant.substring(0, 13) + "…" : lotIdentifiant}
          </text>
        </g>
      )}

      {/* VOLUME INDICATOR */}
      {!isEmpty && (
        <text x="100" y="178" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">
          {volumeOccupe.toLocaleString()}L / {volumeMax.toLocaleString()}L
        </text>
      )}

      {/* FILL % INDICATOR (inside liquid zone) */}
      {!isEmpty && (
        <text x="100" y={Math.max(liquidY + 16, bodyTop + 20)} textAnchor="middle" fontSize="16" fontWeight="bold" fill="white" fillOpacity="0.8" fontFamily="monospace">
          {Math.round(fillPct)}%
        </text>
      )}
    </svg>
  );
}
