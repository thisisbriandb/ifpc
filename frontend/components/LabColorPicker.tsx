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

// Dimensions du demi-cercle chromatique
const WIDTH = 240;
const HEIGHT = 145;
const ORIGIN_X = 120;
const ORIGIN_Y = 132;
const RADIUS = 115;
const MAX_CHROMA = 85;

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

  // Redraw canvas based on L* value
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(WIDTH, HEIGHT);
    const data = imageData.data;

    // Rendu en demi-cercle (portion de l'espace cidre b* >= 0)
    for (let py = 0; py < HEIGHT; py++) {
      const dy = ORIGIN_Y - py; // dy > 0 vers le haut (+b*)

      for (let px = 0; px < WIDTH; px++) {
        const dx = px - ORIGIN_X;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (py * WIDTH + px) * 4;

        if (dy < 0 || dist > RADIUS) {
          // Hors du demi-cercle : transparent
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
          continue;
        }

        const aVal = (dx / RADIUS) * MAX_CHROMA;
        const bVal = (dy / RADIUS) * MAX_CHROMA;

        const [X, Y, Z] = labToXyz(L, aVal, bVal);
        const [r, g, bl] = xyzToSrgb(X, Y, Z);

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = bl;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // ── Tracés des repères chromatiques ──
    ctx.save();

    // Bordure du demi-cercle
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ORIGIN_X, ORIGIN_Y, RADIUS, Math.PI, 0, false);
    ctx.lineTo(ORIGIN_X - RADIUS, ORIGIN_Y);
    ctx.stroke();

    // Arcs concentriques de saturation (b* = 20, 40, 60, 80)
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    [20, 40, 60, 80].forEach((bTick) => {
      const r = (bTick / MAX_CHROMA) * RADIUS;
      ctx.beginPath();
      ctx.arc(ORIGIN_X, ORIGIN_Y, r, Math.PI, 0, false);
      ctx.stroke();
    });

    // Axe vertical (+b*, jaune / ambre)
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, ORIGIN_Y);
    ctx.lineTo(ORIGIN_X, ORIGIN_Y - RADIUS);
    ctx.stroke();

    // Rayons angulaires caractéristiques pour les cidres
    const angles = [Math.PI / 4, Math.PI / 3, (2 * Math.PI) / 3]; // 45°, 60°, 120°
    angles.forEach((ang) => {
      ctx.beginPath();
      ctx.moveTo(ORIGIN_X, ORIGIN_Y);
      ctx.lineTo(ORIGIN_X + Math.cos(ang) * RADIUS, ORIGIN_Y - Math.sin(ang) * RADIUS);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Textes / Annotations
    ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(17,24,39,0.65)";
    ctx.textAlign = "center";
    ctx.fillText("+b* = 80", ORIGIN_X, 12);

    ctx.font = "8px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(17,24,39,0.45)";
    ctx.textAlign = "left";
    ctx.fillText("−a*", 10, ORIGIN_Y - 4);
    ctx.textAlign = "right";
    ctx.fillText("+a*", WIDTH - 10, ORIGIN_Y - 4);
    ctx.textAlign = "center";
    ctx.fillText("b* = 0", ORIGIN_X, ORIGIN_Y + 10);

    ctx.restore();
  }, [L]);

  // Convert mouse position to a*, b*
  const posToAb = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = Math.max(0, Math.min(WIDTH, clientX - rect.left));
    const py = Math.max(0, Math.min(HEIGHT, clientY - rect.top));

    const dx = px - ORIGIN_X;
    let dy = ORIGIN_Y - py;
    if (dy < 0) dy = 0; // clamp b* >= 0

    const dist = Math.sqrt(dx * dx + dy * dy);
    let finalDx = dx;
    let finalDy = dy;

    if (dist > RADIUS) {
      finalDx = (dx / dist) * RADIUS;
      finalDy = (dy / dist) * RADIUS;
    }

    const aVal = Math.round(((finalDx / RADIUS) * MAX_CHROMA) * 10) / 10;
    const bVal = Math.round(((finalDy / RADIUS) * MAX_CHROMA) * 10) / 10;

    onChangeA(Math.max(-45, Math.min(50, aVal)));
    onChangeB(Math.max(0, Math.min(MAX_CHROMA, bVal)));
  }, [onChangeA, onChangeB]);

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

  // Position of cursor on semi-circle
  const clampedB = Math.max(0, Math.min(MAX_CHROMA, b));
  const clampedA = Math.max(-MAX_CHROMA, Math.min(MAX_CHROMA, a));

  let cursorX = ORIGIN_X + (clampedA / MAX_CHROMA) * RADIUS;
  let cursorY = ORIGIN_Y - (clampedB / MAX_CHROMA) * RADIUS;

  // Clamp cursor inside radius
  const cdx = cursorX - ORIGIN_X;
  const cdy = ORIGIN_Y - cursorY;
  const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
  if (cdist > RADIUS) {
    cursorX = ORIGIN_X + (cdx / cdist) * RADIUS;
    cursorY = ORIGIN_Y - (cdy / cdist) * RADIUS;
  }

  const currentHex = labToHex(L, a, b);

  return (
    <div className="space-y-3">
      {/* Preset Chips */}
      <div className="flex flex-wrap gap-1.5 justify-center py-0.5">
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
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-black/[0.05] rounded-lg transition-all text-[10px] font-medium text-gray-700 hover:border-black/10 active:scale-95"
            >
              <div className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: hex }} />
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Demi-cercle Canvas */}
      <div className="flex flex-col items-center">
        <div
          ref={containerRef}
          className="relative max-w-full shadow-inner border border-black/[0.06] bg-gray-50 overflow-hidden rounded-t-full rounded-b-xl"
          style={{ width: WIDTH, height: HEIGHT }}
        >
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="cursor-crosshair block rounded-t-full rounded-b-xl"
            style={{ width: WIDTH, height: HEIGHT }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          {/* Crosshair cursor */}
          <div
            className="absolute pointer-events-none transition-transform duration-75"
            style={{
              left: cursorX - 10,
              top: cursorY - 10,
              width: 20,
              height: 20,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="2.5" />
              <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
              <circle cx="10" cy="10" r="2" fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Lightness Slider */}
      <div className="space-y-1.5 px-1">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Luminosité (L*)</label>
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
