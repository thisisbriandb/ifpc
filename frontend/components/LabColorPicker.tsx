"use client";

import { useRef, useCallback, useState, useEffect } from "react";

// ── Lab → sRGB conversion helpers ──────────────────────────────────────────

function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const delta = 6 / 29;
  const inv = (t: number) => (t > delta ? t * t * t : 3 * delta * delta * (t - 4 / 29));

  // D65 white point
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  return [Xn * inv(fx), Yn * inv(fy), Zn * inv(fz)];
}

function xyzToSrgb(X: number, Y: number, Z: number): [number, number, number] {
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;

  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return [
    Math.round(Math.max(0, Math.min(1, gamma(r))) * 255),
    Math.round(Math.max(0, Math.min(1, gamma(g))) * 255),
    Math.round(Math.max(0, Math.min(1, gamma(b))) * 255),
  ];
}

function labToHex(L: number, a: number, b: number): string {
  const [X, Y, Z] = labToXyz(L, a, b);
  const [r, g, bl] = xyzToSrgb(X, Y, Z);
  return `#${[r, g, bl].map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface LabColorPickerProps {
  L: number;
  a: number;
  b: number;
  onChangeL: (v: number) => void;
  onChangeA: (v: number) => void;
  onChangeB: (v: number) => void;
}

const SIZE = 240;
const RADIUS = SIZE / 2;
const AB_RANGE = 128;

// Presets de couleurs typiques de cidres
const CIDER_PRESETS = [
  { name: "Paille", L: 92, a: -1.5, b: 22 },
  { name: "Jaune Or", L: 85, a: 4.0, b: 35 },
  { name: "Ambré", L: 75, a: 12.0, b: 50 },
  { name: "Cuivré", L: 65, a: 18.0, b: 58 },
  { name: "Roux", L: 55, a: 22.0, b: 62 },
];

export default function LabColorPicker({ L, a, b, onChangeL, onChangeA, onChangeB }: LabColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pickerMode, setPickerMode] = useState<"cidre" | "full">("cidre");

  // Redraw canvas based on mode and L* value
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(SIZE, SIZE);
    const data = imageData.data;

    if (pickerMode === "cidre") {
      // Espace des cidres : a* in [-5, 30], b* in [0, 80]
      for (let py = 0; py < SIZE; py++) {
        const v = py / SIZE;
        const bVal = 80 - v * 80;

        for (let px = 0; px < SIZE; px++) {
          const u = px / SIZE;
          const aVal = -5 + u * 35;

          const [X, Y, Z] = labToXyz(L, aVal, bVal);
          const [r, g, bl] = xyzToSrgb(X, Y, Z);

          const idx = (py * SIZE + px) * 4;
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Grille pour l'espace des cidres
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;

      // Lignes verticales pour a* (-5, 5, 15, 25)
      [-5, 5, 15, 25].forEach((aTick) => {
        const x = ((aTick - (-5)) / 35) * SIZE;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIZE); ctx.stroke();
      });

      // Lignes horizontales pour b* (20, 40, 60)
      [20, 40, 60].forEach((bTick) => {
        const y = ((80 - bTick) / 80) * SIZE;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
      });

      ctx.font = "bold 9px system-ui";
      ctx.fillStyle = "rgba(17,24,39,0.6)";
      ctx.textAlign = "center";
      ctx.fillText("+b* = 80", RADIUS, 12);
      ctx.fillText("b* = 0", RADIUS, SIZE - 5);
      ctx.textAlign = "left";
      ctx.fillText("a* = 30", SIZE - 38, RADIUS);
      ctx.fillText("a* = -5", 5, RADIUS);

    } else {
      // Espace complet CIELAB : disque a*, b* in [-128, +128]
      for (let py = 0; py < SIZE; py++) {
        for (let px = 0; px < SIZE; px++) {
          const dx = px - RADIUS;
          const dy = py - RADIUS;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const idx = (py * SIZE + px) * 4;
          if (dist > RADIUS) {
            data[idx] = 245; data[idx + 1] = 245; data[idx + 2] = 245; data[idx + 3] = 0;
            continue;
          }

          const aVal = (dx / RADIUS) * AB_RANGE;
          const bVal = -(dy / RADIUS) * AB_RANGE;

          const [X, Y, Z] = labToXyz(L, aVal, bVal);
          const [r, g, bl] = xyzToSrgb(X, Y, Z);
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Grille et cercles pour l'espace complet
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      for (let value = -100; value <= 100; value += 10) {
        const x = RADIUS + (value / AB_RANGE) * RADIUS;
        const y = RADIUS - (value / AB_RANGE) * RADIUS;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      [0.25, 0.5, 0.75, 1].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(RADIUS, RADIUS, RADIUS * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(0, RADIUS); ctx.lineTo(SIZE, RADIUS); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(RADIUS, 0); ctx.lineTo(RADIUS, SIZE); ctx.stroke();

      ctx.font = "bold 10px system-ui";
      ctx.fillStyle = "rgba(17,24,39,0.5)";
      ctx.textAlign = "center";
      ctx.fillText("+b*", RADIUS, 13);
      ctx.fillText("−b*", RADIUS, SIZE - 6);
      ctx.textAlign = "left";
      ctx.fillText("+a*", SIZE - 25, RADIUS - 6);
      ctx.textAlign = "right";
      ctx.fillText("−a*", 25, RADIUS - 6);
    }
  }, [L, pickerMode]);

  // Convert mouse position to a*, b*
  const posToAb = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = Math.max(0, Math.min(SIZE, clientX - rect.left));
    const py = Math.max(0, Math.min(SIZE, clientY - rect.top));

    if (pickerMode === "cidre") {
      const aVal = Math.round((-5 + (px / SIZE) * 35) * 10) / 10;
      const bVal = Math.round((80 - (py / SIZE) * 80) * 10) / 10;
      onChangeA(aVal);
      onChangeB(bVal);
    } else {
      const dx = px - RADIUS;
      const dy = py - RADIUS;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > RADIUS) return;
      const aVal = Math.round(((dx / RADIUS) * AB_RANGE) * 10) / 10;
      const bVal = Math.round((-(dy / RADIUS) * AB_RANGE) * 10) / 10;
      onChangeA(aVal);
      onChangeB(bVal);
    }
  }, [pickerMode, onChangeA, onChangeB]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    posToAb(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    posToAb(e.clientX, e.clientY);
  };

  const handlePointerUp = () => setDragging(false);

  // Position of cursor on disc / rect
  let cursorX: number;
  let cursorY: number;

  if (pickerMode === "cidre") {
    cursorX = Math.max(0, Math.min(SIZE, ((a - (-5)) / 35) * SIZE));
    cursorY = Math.max(0, Math.min(SIZE, ((80 - b) / 80) * SIZE));
  } else {
    cursorX = Math.max(0, Math.min(SIZE, RADIUS + (a / AB_RANGE) * RADIUS));
    cursorY = Math.max(0, Math.min(SIZE, RADIUS - (b / AB_RANGE) * RADIUS));
  }

  const currentHex = labToHex(L, a, b);

  return (
    <div className="space-y-3">
      {/* Mode Switch Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Modèle de couleur
        </p>
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-black/[0.04]">
          <button
            type="button"
            onClick={() => setPickerMode("cidre")}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
              pickerMode === "cidre"
                ? "bg-white text-brand-primary shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Espace Cidres
          </button>
          <button
            type="button"
            onClick={() => setPickerMode("full")}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
              pickerMode === "full"
                ? "bg-white text-brand-primary shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Espace complet
          </button>
        </div>
      </div>

      {/* Preset Chips (Espace Cidres) */}
      {pickerMode === "cidre" && (
        <div className="flex flex-wrap gap-1.5 justify-center py-1">
          {CIDER_PRESETS.map((preset) => {
            const hex = labToHex(preset.L, preset.a, preset.b);
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  onChangeL(preset.L);
                  onChangeA(preset.a);
                  onChangeB(preset.b);
                }}
                className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-black/[0.05] rounded-lg transition-all text-[10px] font-medium text-gray-700"
              >
                <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Canvas */}
      <div className="flex flex-col items-center">
        <div
          ref={containerRef}
          className={`relative max-w-full shadow-inner border border-black/[0.06] bg-gray-50 overflow-hidden ${
            pickerMode === "cidre" ? "rounded-2xl" : "rounded-full"
          }`}
          style={{ width: SIZE, height: SIZE }}
        >
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className={`cursor-crosshair block ${pickerMode === "cidre" ? "rounded-2xl" : "rounded-full"}`}
            style={{ width: SIZE, height: SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          {/* Crosshair cursor */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: cursorX - 10,
              top: cursorY - 10,
              width: 20,
              height: 20,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="2.5" />
              <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
              <circle cx="10" cy="10" r="2" fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Lightness Slider */}
      <div className="space-y-1.5 px-1">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-gray-400 uppercase">Lumière (L*)</label>
          <span className="text-[10px] font-mono font-bold text-gray-700">{L.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="0.5"
          value={L}
          onChange={(e) => onChangeL(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary focus:outline-none"
        />
      </div>

      {/* Color preview + values */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-black/[0.04]">
        <div
          className="w-10 h-10 rounded-lg shadow-inner border border-black/[0.06] shrink-0"
          style={{ backgroundColor: currentHex }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-brand-text font-mono">{currentHex.toUpperCase()}</p>
          <p className="text-[10px] text-gray-400">
            L*={L.toFixed(1)} a*={a.toFixed(1)} b*={b.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}
