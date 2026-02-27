"use client";

import { useEffect, useState } from "react";
import { getProduits, getMicroorganismes, getProcedes } from "@/lib/api";

interface Props {
  productType: string;
  onProductChange: (v: string) => void;
  microorganisme: string;
  onMicroChange: (v: string) => void;
  clarification: string;
  onClarificationChange: (v: string) => void;
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
  clarification, onClarificationChange,
  procede, onProcedeChange,
  expertMode = false,
  tRef, onTRefChange,
  zValue, onZChange,
  ph, onPhChange,
  titreAlcool, onTitreAlcoolChange,
}: Props) {
  const [produits, setProduits] = useState<any[]>([]);
  const [micros, setMicros] = useState<any[]>([]);
  const [procedes, setProcedes] = useState<any[]>([]);

  useEffect(() => {
    getProduits().then(setProduits).catch(() => {});
    getMicroorganismes().then(setMicros).catch(() => {});
    getProcedes().then(setProcedes).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type de produit
        </label>
        <select
          value={productType}
          onChange={(e) => onProductChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none text-sm"
        >
          {produits.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Clarification
        </label>
        <select
          value={clarification}
          onChange={(e) => onClarificationChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none text-sm"
        >
          <option value="trouble">Trouble</option>
          <option value="limpide">Limpide</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Procédé
        </label>
        <select
          value={procede}
          onChange={(e) => onProcedeChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none text-sm"
        >
          {procedes.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      {expertMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Microorganisme cible
          </label>
          <select
            value={microorganisme}
            onChange={(e) => onMicroChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none text-sm"
          >
            <option value="">Auto (selon produit)</option>
            {micros.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}</option>
            ))}
          </select>
        </div>
      )}

      {expertMode && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tref (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={tRef}
              onChange={(e) => onTRefChange?.(e.target.value)}
              placeholder="60.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Z (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={zValue}
              onChange={(e) => onZChange?.(e.target.value)}
              placeholder="7.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              pH
            </label>
            <input
              type="number"
              step="0.1"
              value={ph}
              onChange={(e) => onPhChange?.(e.target.value)}
              placeholder="3.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre alcoométrique (% vol.)
            </label>
            <input
              type="number"
              step="0.1"
              value={titreAlcool}
              onChange={(e) => onTitreAlcoolChange?.(e.target.value)}
              placeholder="0.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none text-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}
