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

function isInGamut(L: number, a: number, b: number): boolean {
  const [X, Y, Z] = labToXyz(L, a, b);
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let bl = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return [gamma(r), gamma(g), gamma(bl)].every(c => c >= -0.01 && c <= 1.01);
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

// ── Component ──────────────────────────────────────────────────────────────

export default function LabColorPicker({ L, a, b, onChangeA, onChangeB, onChangeL }: LabColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const SIZE = 220;
  const RADIUS = SIZE / 2;
  const AB_RANGE = 60; // range: -60..+60

  // Draw the a*b* disc
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(SIZE, SIZE);
    const data = imageData.data;

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
        const bVal = -(dy / RADIUS) * AB_RANGE; // y flipped: top = +b

        if (isInGamut(L, aVal, bVal)) {
          const [X, Y, Z] = labToXyz(L, aVal, bVal);
          const [r, g, bl] = xyzToSrgb(X, Y, Z);
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;
        } else {
          // Out of gamut: faint gray
          data[idx] = 230; data[idx + 1] = 230; data[idx + 2] = 230; data[idx + 3] = 80;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw axis lines
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, RADIUS); ctx.lineTo(SIZE, RADIUS); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(RADIUS, 0); ctx.lineTo(RADIUS, SIZE); ctx.stroke();

    // Axis labels
    ctx.font = "bold 9px system-ui";
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.textAlign = "center";
    ctx.fillText("+b* (jaune)", RADIUS, 11);
    ctx.fillText("−b* (bleu)", RADIUS, SIZE - 4);
    ctx.textAlign = "left";
    ctx.fillText("+a* (rouge)", SIZE - 52, RADIUS - 5);
    ctx.textAlign = "right";
    ctx.fillText("−a* (vert)", 52, RADIUS - 5);
  }, [L]);

  // Convert mouse position to a*, b*
  const posToAb = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const dx = px - RADIUS;
    const dy = py - RADIUS;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > RADIUS) return; // outside disc
    const aVal = Math.round(((dx / RADIUS) * AB_RANGE) * 10) / 10;
    const bVal = Math.round((-(dy / RADIUS) * AB_RANGE) * 10) / 10;
    onChangeA(aVal);
    onChangeB(bVal);
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

  // Position of cursor on disc
  const cursorX = RADIUS + (a / AB_RANGE) * RADIUS;
  const cursorY = RADIUS - (b / AB_RANGE) * RADIUS;
  const currentHex = labToHex(L, a, b);

  return (
    <div className="space-y-3">
      {/* a*b* disc */}
      <div className="flex flex-col items-center">
        <div ref={containerRef} className="relative" style={{ width: SIZE, height: SIZE }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="rounded-full cursor-crosshair"
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

      {/* L* slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-400 uppercase">L* (luminosité)</p>
          <span className="text-[11px] font-mono font-bold text-gray-600">{L.toFixed(0)}</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0" max="100" step="1"
            value={L}
            onChange={(e) => onChangeL(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${labToHex(0, a, b)}, ${labToHex(50, a, b)}, ${labToHex(100, a, b)})`,
            }}
          />
        </div>
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
