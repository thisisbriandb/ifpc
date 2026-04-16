"use client";

import { useEffect, useState, useCallback } from "react";
import { getProduits, getMicroorganismes, getProcedes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// Fallback data mirroring backend pasto.py definitions
const FALLBACK_PRODUITS = [
  { id: "jus_pomme", nom: "Jus de pomme" },
  { id: "cidre_doux", nom: "Cidre doux" },
  { id: "cidre_demi_sec", nom: "Cidre demi-sec" },
  { id: "cidre_brut", nom: "Cidre brut" },
  { id: "cidre_extra_brut", nom: "Cidre extra-brut" },
];

const FALLBACK_PROCEDES = [
  { id: "flash", nom: "Pasteurisation flash" },
  { id: "classique", nom: "Pasteurisation classique" },
  { id: "tunnel", nom: "Tunnel / douchette" },
];

interface Props {
  productType: string;
  onProductChange: (v: string) => void;
  microorganisme: string;
  onMicroChange: (v: string) => void;
  procede: string;
  onProcedeChange: (v: string) => void;
  expertMode?: boolean;
  tRef?: string;
  onTRefChange?: (v: string) => void;
  zValue?: string;
  onZChange?: (v: string) => void;
  ph?: string;
  onPhChange?: (v: string) => void;
  titreAlcool?: string;
  onTitreAlcoolChange?: (v: string) => void;
}

export default function ProductSelector({
  productType, onProductChange,
  microorganisme, onMicroChange,
  procede, onProcedeChange,
  expertMode = false,
  tRef, onTRefChange,
  zValue, onZChange,
  ph, onPhChange,
  titreAlcool, onTitreAlcoolChange,
}: Props) {
  const { t, locale } = useI18n();
  const [produits, setProduits] = useState<any[]>(FALLBACK_PRODUITS);
  const [micros, setMicros] = useState<any[]>([]);
  const [procedes, setProcedes] = useState<any[]>(FALLBACK_PROCEDES);

  const fetchWithRetry = useCallback(async (
    fetcher: () => Promise<any[]>,
    setter: (data: any[]) => void,
    retries = 3,
  ) => {
    for (let i = 0; i < retries; i++) {
      try {
        const data = await fetcher();
        if (Array.isArray(data) && data.length > 0) {
          setter(data);
          return;
        }
      } catch {
        // wait before retry
      }
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }, []);

  useEffect(() => {
    fetchWithRetry(() => getProduits(locale), setProduits);
    fetchWithRetry(() => getMicroorganismes(locale), setMicros);
    fetchWithRetry(() => getProcedes(locale), setProcedes);
  }, [fetchWithRetry, locale]);

  const selectCls = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none text-xs bg-white";
  const inputCls = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent outline-none text-xs";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>{t("productSelector.product")}</label>
        <select value={productType} onChange={(e) => onProductChange(e.target.value)} className={selectCls}>
          {produits.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Procédé */}
      <div>
        <label className={labelCls}>{t("productSelector.process")}</label>
        <select value={procede} onChange={(e) => onProcedeChange(e.target.value)} className={selectCls}>
          {procedes.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      {/* Expert fields */}
      {expertMode && (
        <div className="pt-1.5 border-t border-gray-100 space-y-2.5">
          <div>
            <label className={labelCls}>{t("productSelector.microorganism")}</label>
            <select
              value={microorganisme}
              onChange={(e) => {
                const id = e.target.value;
                onMicroChange(id);
                const selected = micros.find((m) => m.id === id);
                if (selected) {
                  onTRefChange?.(String(selected.t_ref));
                  onZChange?.(String(selected.z));
                } else {
                  onTRefChange?.("");
                  onZChange?.("");
                }
              }}
              className={selectCls}
            >
              <option value="">{t("productSelector.autoByProduct")}</option>
              {micros.map((m) => (
                <option key={m.id} value={m.id}>{m.nom} — D={m.d_ref} min @ {m.t_ref}°C</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Tref (°C)</label>
              <input type="number" step="0.1" value={tRef} onChange={(e) => onTRefChange?.(e.target.value)} placeholder="60.0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Z (°C)</label>
              <input type="number" step="0.1" value={zValue} onChange={(e) => onZChange?.(e.target.value)} placeholder="7.0" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>pH</label>
              <input type="number" step="0.1" value={ph} onChange={(e) => onPhChange?.(e.target.value)} placeholder="3.5" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("productSelector.alcohol")}</label>
              <input type="number" step="0.1" value={titreAlcool} onChange={(e) => onTitreAlcoolChange?.(e.target.value)} placeholder="0.0" className={inputCls} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
