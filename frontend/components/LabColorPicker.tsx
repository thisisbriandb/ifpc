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

const WIDTH = 240;
const RADIUS = 114;

// Paramètres Espace Cidre (demi-cercle b* >= 0)
const CIDRE_HEIGHT = 145;
const CIDRE_ORIGIN_X = 120;
const CIDRE_ORIGIN_Y = 132;
const CIDRE_MAX_CHROMA = 85;

// Paramètres Espace Complet (disque 360°)
const FULL_HEIGHT = 240;
const FULL_ORIGIN_X = 120;
const FULL_ORIGIN_Y = 120;
const FULL_AB_RANGE = 128;

export default function LabColorPicker({ L, a, b, onChangeL, onChangeA, onChangeB }: LabColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pickerMode, setPickerMode] = useState<"cidre" | "full">("cidre");

  const canvasHeight = pickerMode === "cidre" ? CIDRE_HEIGHT : FULL_HEIGHT;

  // Redraw canvas based on mode and L* value
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, canvasHeight);

    const imageData = ctx.createImageData(WIDTH, canvasHeight);
    const data = imageData.data;

    if (pickerMode === "cidre") {
      // ── Rendu Espace Cidre : Demi-cercle (b* >= 0) ──
      for (let py = 0; py < CIDRE_HEIGHT; py++) {
        const dy = CIDRE_ORIGIN_Y - py;

        for (let px = 0; px < WIDTH; px++) {
          const dx = px - CIDRE_ORIGIN_X;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const idx = (py * WIDTH + px) * 4;

          if (dy < 0 || dist > RADIUS) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            continue;
          }

          const aVal = (dx / RADIUS) * CIDRE_MAX_CHROMA;
          const bVal = (dy / RADIUS) * CIDRE_MAX_CHROMA;

          const [X, Y, Z] = labToXyz(L, aVal, bVal);
          const [r, g, bl] = xyzToSrgb(X, Y, Z);

          data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Repères chromatiques cidre
      ctx.save();

      // Bordure demi-cercle
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(CIDRE_ORIGIN_X, CIDRE_ORIGIN_Y, RADIUS, Math.PI, 0, false);
      ctx.lineTo(CIDRE_ORIGIN_X - RADIUS, CIDRE_ORIGIN_Y);
      ctx.stroke();

      // Arcs de saturation (b* = 20, 40, 60, 80)
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      [20, 40, 60, 80].forEach((bTick) => {
        const r = (bTick / CIDRE_MAX_CHROMA) * RADIUS;
        ctx.beginPath();
        ctx.arc(CIDRE_ORIGIN_X, CIDRE_ORIGIN_Y, r, Math.PI, 0, false);
        ctx.stroke();
      });

      // Axe vertical (+b*)
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(CIDRE_ORIGIN_X, CIDRE_ORIGIN_Y);
      ctx.lineTo(CIDRE_ORIGIN_X, CIDRE_ORIGIN_Y - RADIUS);
      ctx.stroke();

      // Rayons angulaires caractéristiques pour cidres (45°, 60°, 120°)
      [Math.PI / 4, Math.PI / 3, (2 * Math.PI) / 3].forEach((ang) => {
        ctx.beginPath();
        ctx.moveTo(CIDRE_ORIGIN_X, CIDRE_ORIGIN_Y);
        ctx.lineTo(CIDRE_ORIGIN_X + Math.cos(ang) * RADIUS, CIDRE_ORIGIN_Y - Math.sin(ang) * RADIUS);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Annotations
      ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(17,24,39,0.7)";
      ctx.textAlign = "center";
      ctx.fillText("+b* = 80", CIDRE_ORIGIN_X, 12);

      ctx.font = "8px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(17,24,39,0.5)";
      ctx.textAlign = "left";
      ctx.fillText("−a*", 10, CIDRE_ORIGIN_Y - 4);
      ctx.textAlign = "right";
      ctx.fillText("+a*", WIDTH - 10, CIDRE_ORIGIN_Y - 4);
      ctx.textAlign = "center";
      ctx.fillText("b* = 0", CIDRE_ORIGIN_X, CIDRE_ORIGIN_Y + 10);

      ctx.restore();

    } else {
      // ── Rendu Espace Complet : Disque 360° (a*, b* in [-128, +128]) ──
      for (let py = 0; py < FULL_HEIGHT; py++) {
        const dy = FULL_ORIGIN_Y - py;

        for (let px = 0; px < WIDTH; px++) {
          const dx = px - FULL_ORIGIN_X;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const idx = (py * WIDTH + px) * 4;

          if (dist > RADIUS) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            continue;
          }

          const aVal = (dx / RADIUS) * FULL_AB_RANGE;
          const bVal = (dy / RADIUS) * FULL_AB_RANGE;

          const [X, Y, Z] = labToXyz(L, aVal, bVal);
          const [r, g, bl] = xyzToSrgb(X, Y, Z);

          data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Repères Espace Complet
      ctx.save();

      // Cercles concentriques
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = 1;
      [0.33, 0.66, 1].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(FULL_ORIGIN_X, FULL_ORIGIN_Y, RADIUS * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Axes principaux (+b*, -b*, +a*, -a*)
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(FULL_ORIGIN_X, 0);
      ctx.lineTo(FULL_ORIGIN_X, FULL_HEIGHT);
      ctx.moveTo(0, FULL_ORIGIN_Y);
      ctx.lineTo(WIDTH, FULL_ORIGIN_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Mise en valeur de la zone des cidres sur le disque complet
      const ciderR = (CIDRE_MAX_CHROMA / FULL_AB_RANGE) * RADIUS;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(FULL_ORIGIN_X, FULL_ORIGIN_Y, ciderR, Math.PI, 0, false);
      ctx.lineTo(FULL_ORIGIN_X + ciderR, FULL_ORIGIN_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Annotations
      ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(17,24,39,0.7)";
      ctx.textAlign = "center";
      ctx.fillText("+b*", FULL_ORIGIN_X, 12);
      ctx.fillText("−b*", FULL_ORIGIN_X, FULL_HEIGHT - 4);
      ctx.textAlign = "right";
      ctx.fillText("+a*", WIDTH - 6, FULL_ORIGIN_Y - 4);
      ctx.textAlign = "left";
      ctx.fillText("−a*", 6, FULL_ORIGIN_Y - 4);

      // Label zone cidre
      ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.textAlign = "center";
      ctx.fillText("Zone Cidres", FULL_ORIGIN_X, FULL_ORIGIN_Y - ciderR / 2);

      ctx.restore();
    }
  }, [L, pickerMode, canvasHeight]);

  // Convert mouse position to a*, b*
  const posToAb = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = Math.max(0, Math.min(WIDTH, clientX - rect.left));
    const py = Math.max(0, Math.min(canvasHeight, clientY - rect.top));

    if (pickerMode === "cidre") {
      const dx = px - CIDRE_ORIGIN_X;
      let dy = CIDRE_ORIGIN_Y - py;
      if (dy < 0) dy = 0; // clamp b* >= 0

      const dist = Math.sqrt(dx * dx + dy * dy);
      let finalDx = dx;
      let finalDy = dy;
      if (dist > RADIUS) {
        finalDx = (dx / dist) * RADIUS;
        finalDy = (dy / dist) * RADIUS;
      }

      const aVal = Math.round(((finalDx / RADIUS) * CIDRE_MAX_CHROMA) * 10) / 10;
      const bVal = Math.round(((finalDy / RADIUS) * CIDRE_MAX_CHROMA) * 10) / 10;

      onChangeA(Math.max(-45, Math.min(50, aVal)));
      onChangeB(Math.max(0, Math.min(CIDRE_MAX_CHROMA, bVal)));
    } else {
      const dx = px - FULL_ORIGIN_X;
      const dy = FULL_ORIGIN_Y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let finalDx = dx;
      let finalDy = dy;
      if (dist > RADIUS) {
        finalDx = (dx / dist) * RADIUS;
        finalDy = (dy / dist) * RADIUS;
      }

      const aVal = Math.round(((finalDx / RADIUS) * FULL_AB_RANGE) * 10) / 10;
      const bVal = Math.round(((finalDy / RADIUS) * FULL_AB_RANGE) * 10) / 10;

      onChangeA(Math.max(-FULL_AB_RANGE, Math.min(FULL_AB_RANGE, aVal)));
      onChangeB(Math.max(-FULL_AB_RANGE, Math.min(FULL_AB_RANGE, bVal)));
    }
  }, [pickerMode, canvasHeight, onChangeA, onChangeB]);

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

  // Position of cursor
  let cursorX: number;
  let cursorY: number;

  if (pickerMode === "cidre") {
    const clampedB = Math.max(0, Math.min(CIDRE_MAX_CHROMA, b));
    const clampedA = Math.max(-CIDRE_MAX_CHROMA, Math.min(CIDRE_MAX_CHROMA, a));

    cursorX = CIDRE_ORIGIN_X + (clampedA / CIDRE_MAX_CHROMA) * RADIUS;
    cursorY = CIDRE_ORIGIN_Y - (clampedB / CIDRE_MAX_CHROMA) * RADIUS;

    const cdx = cursorX - CIDRE_ORIGIN_X;
    const cdy = CIDRE_ORIGIN_Y - cursorY;
    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
    if (cdist > RADIUS) {
      cursorX = CIDRE_ORIGIN_X + (cdx / cdist) * RADIUS;
      cursorY = CIDRE_ORIGIN_Y - (cdy / cdist) * RADIUS;
    }
  } else {
    const clampedB = Math.max(-FULL_AB_RANGE, Math.min(FULL_AB_RANGE, b));
    const clampedA = Math.max(-FULL_AB_RANGE, Math.min(FULL_AB_RANGE, a));

    cursorX = FULL_ORIGIN_X + (clampedA / FULL_AB_RANGE) * RADIUS;
    cursorY = FULL_ORIGIN_Y - (clampedB / FULL_AB_RANGE) * RADIUS;

    const cdx = cursorX - FULL_ORIGIN_X;
    const cdy = FULL_ORIGIN_Y - cursorY;
    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
    if (cdist > RADIUS) {
      cursorX = FULL_ORIGIN_X + (cdx / cdist) * RADIUS;
      cursorY = FULL_ORIGIN_Y - (cdy / cdist) * RADIUS;
    }
  }

  const currentHex = labToHex(L, a, b);

  return (
    <div className="space-y-3">
      {/* Mode Switcher Toggle (sans libellé "Modèle de couleur") */}
      <div className="flex justify-center">
        <div className="flex bg-gray-100 p-0.5 rounded-xl border border-black/[0.04] w-full max-w-[240px]">
          <button
            type="button"
            onClick={() => setPickerMode("cidre")}
            className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
              pickerMode === "cidre"
                ? "bg-white text-brand-primary shadow-sm"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            Espace cidre
          </button>
          <button
            type="button"
            onClick={() => setPickerMode("full")}
            className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
              pickerMode === "full"
                ? "bg-white text-brand-primary shadow-sm"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            Espace complet
          </button>
        </div>
      </div>

      {/* Canvas chromatique avec transition fluide */}
      <div className="flex flex-col items-center">
        <div
          ref={containerRef}
          className={`relative max-w-full shadow-inner border border-black/[0.06] bg-gray-50 overflow-hidden transition-all duration-300 ease-out ${
            pickerMode === "cidre"
              ? "rounded-t-full rounded-b-xl"
              : "rounded-full"
          }`}
          style={{ width: WIDTH, height: canvasHeight }}
        >
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={canvasHeight}
            className={`cursor-crosshair block transition-all duration-300 ease-out ${
              pickerMode === "cidre" ? "rounded-t-full rounded-b-xl" : "rounded-full"
            }`}
            style={{ width: WIDTH, height: canvasHeight }}
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
