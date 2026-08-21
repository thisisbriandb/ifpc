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

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

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

// Paramètres Espace Cidre : plan cartésien a*/b* (rectangle avec axes tracés
// à l'intérieur, pour que l'utilisateur situe sa cible d'un coup d'œil).
// La bande b* < 0 existe uniquement pour que l'axe a* (b* = 0) tombe DANS le
// cadre et non sur son bord.
const CIDRE_HEIGHT = 200;
const CIDRE_A_MIN = -10;
const CIDRE_A_MAX = 40;
const CIDRE_B_MIN = -5;
const CIDRE_B_MAX = 85;

// Paramètres Espace Complet (disque 360°)
const FULL_HEIGHT = 240;
const FULL_ORIGIN_X = 120;
const FULL_ORIGIN_Y = 120;
const FULL_AB_RANGE = 128;

// Projections espace cidre ↔ pixels
const cidreX = (aVal: number) => ((aVal - CIDRE_A_MIN) / (CIDRE_A_MAX - CIDRE_A_MIN)) * WIDTH;
const cidreY = (bVal: number) => ((CIDRE_B_MAX - bVal) / (CIDRE_B_MAX - CIDRE_B_MIN)) * CIDRE_HEIGHT;

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

    // Étiquette lisible quel que soit le fond : halo blanc + texte sombre
    const drawLabel = (text: string, x: number, y: number, align: CanvasTextAlign = "center") => {
      ctx.textAlign = align;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(text, x, y);
      ctx.fillStyle = "rgba(17,24,39,0.85)";
      ctx.fillText(text, x, y);
    };

    if (pickerMode === "cidre") {
      // ── Rendu Espace Cidre : rectangle a* ∈ [-10, 40], b* ∈ [-5, 85] ──
      for (let py = 0; py < CIDRE_HEIGHT; py++) {
        const bVal = CIDRE_B_MAX - (py / CIDRE_HEIGHT) * (CIDRE_B_MAX - CIDRE_B_MIN);

        for (let px = 0; px < WIDTH; px++) {
          const aVal = CIDRE_A_MIN + (px / WIDTH) * (CIDRE_A_MAX - CIDRE_A_MIN);

          const [X, Y, Z] = labToXyz(L, aVal, bVal);
          const [r, g, bl] = xyzToSrgb(X, Y, Z);

          const idx = (py * WIDTH + px) * 4;
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      ctx.save();

      // Grille au pas de 10 unités
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1;
      for (let aTick = CIDRE_A_MIN; aTick <= CIDRE_A_MAX; aTick += 10) {
        if (aTick === 0) continue; // tracé plus bas comme axe
        const x = cidreX(aTick);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CIDRE_HEIGHT); ctx.stroke();
      }
      for (let bTick = 0; bTick <= CIDRE_B_MAX; bTick += 10) {
        if (bTick === 0) continue; // tracé plus bas comme axe
        const y = cidreY(bTick);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
      }

      // ── Axes tracés À L'INTÉRIEUR du cadre ──
      const axisX = cidreX(0);   // axe b* (vertical, a* = 0)
      const axisY = cidreY(0);   // axe a* (horizontal, b* = 0)

      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(axisX, 0); ctx.lineTo(axisX, CIDRE_HEIGHT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(WIDTH, axisY); ctx.stroke();

      // Graduations de l'axe b* (le long de la verticale a* = 0)
      ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1.5;
      for (let bTick = 20; bTick <= 80; bTick += 20) {
        const y = cidreY(bTick);
        ctx.beginPath(); ctx.moveTo(axisX - 3, y); ctx.lineTo(axisX + 3, y); ctx.stroke();
        drawLabel(String(bTick), axisX + 6, y + 3, "left");
      }

      // Graduations de l'axe a* (le long de l'horizontale b* = 0)
      for (let aTick = CIDRE_A_MIN + 10; aTick <= CIDRE_A_MAX - 10; aTick += 10) {
        if (aTick === 0) continue;
        const x = cidreX(aTick);
        ctx.beginPath(); ctx.moveTo(x, axisY - 3); ctx.lineTo(x, axisY + 3); ctx.stroke();
        drawLabel(String(aTick), x, axisY - 6);
      }

      // Origine + noms des axes (aux extrémités, hors des graduations)
      ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
      drawLabel("0", axisX - 5, axisY - 5, "right");
      drawLabel("b*", axisX - 6, 12, "right");
      drawLabel("a*", WIDTH - 5, axisY - 6, "right");

      // Bornes du cadre
      ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
      drawLabel(`${CIDRE_B_MAX}`, axisX + 6, 12, "left");
      drawLabel(`${CIDRE_A_MIN}`, 4, axisY - 6, "left");

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

      // Mise en valeur de la zone cidre (le rectangle de l'autre mode)
      const rx1 = FULL_ORIGIN_X + (CIDRE_A_MIN / FULL_AB_RANGE) * RADIUS;
      const rx2 = FULL_ORIGIN_X + (CIDRE_A_MAX / FULL_AB_RANGE) * RADIUS;
      const ry1 = FULL_ORIGIN_Y - (CIDRE_B_MAX / FULL_AB_RANGE) * RADIUS;
      const ry2 = FULL_ORIGIN_Y - (CIDRE_B_MIN / FULL_AB_RANGE) * RADIUS;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(rx1, ry1, rx2 - rx1, ry2 - ry1);
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
      drawLabel("Zone Cidres", (rx1 + rx2) / 2, ry1 - 4);

      ctx.restore();
    }
  }, [L, pickerMode, canvasHeight]);

  // Convert mouse position to a*, b*
  const posToAb = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clamp(clientX - rect.left, 0, WIDTH);
    const py = clamp(clientY - rect.top, 0, canvasHeight);

    if (pickerMode === "cidre") {
      const aVal = CIDRE_A_MIN + (px / WIDTH) * (CIDRE_A_MAX - CIDRE_A_MIN);
      const bVal = CIDRE_B_MAX - (py / CIDRE_HEIGHT) * (CIDRE_B_MAX - CIDRE_B_MIN);

      onChangeA(round1(clamp(aVal, CIDRE_A_MIN, CIDRE_A_MAX)));
      onChangeB(round1(clamp(bVal, CIDRE_B_MIN, CIDRE_B_MAX)));
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

      const aVal = round1((finalDx / RADIUS) * FULL_AB_RANGE);
      const bVal = round1((finalDy / RADIUS) * FULL_AB_RANGE);

      onChangeA(clamp(aVal, -FULL_AB_RANGE, FULL_AB_RANGE));
      onChangeB(clamp(bVal, -FULL_AB_RANGE, FULL_AB_RANGE));
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
  let outOfRange = false;

  if (pickerMode === "cidre") {
    outOfRange = a < CIDRE_A_MIN || a > CIDRE_A_MAX || b < CIDRE_B_MIN || b > CIDRE_B_MAX;
    cursorX = clamp(cidreX(a), 0, WIDTH);
    cursorY = clamp(cidreY(b), 0, CIDRE_HEIGHT);
  } else {
    const clampedB = clamp(b, -FULL_AB_RANGE, FULL_AB_RANGE);
    const clampedA = clamp(a, -FULL_AB_RANGE, FULL_AB_RANGE);

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
            pickerMode === "cidre" ? "rounded-xl" : "rounded-full"
          }`}
          style={{ width: WIDTH, height: canvasHeight }}
        >
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={canvasHeight}
            className={`cursor-crosshair block transition-all duration-300 ease-out ${
              pickerMode === "cidre" ? "rounded-xl" : "rounded-full"
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
              opacity: outOfRange ? 0.45 : 1,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="2.5" />
              <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
              <circle cx="10" cy="10" r="2" fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
            </svg>
          </div>
        </div>
        {outOfRange && (
          <p className="mt-1.5 text-[9px] font-bold text-brand-accent uppercase tracking-wider text-center">
            Cible hors de l&apos;espace cidre — voir « Espace complet »
          </p>
        )}
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
