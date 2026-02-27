"use client";

import { useEffect, useState } from "react";
import { getMicroorganismes, getProduits } from "@/lib/api";
import { Database, Bug, Apple } from "lucide-react";

export default function ExpertPage() {
  const [micros, setMicros] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"micro" | "produit">("micro");

  useEffect(() => {
    getMicroorganismes().then(setMicros).catch(() => {});
    getProduits().then(setProduits).catch(() => {});
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mode expert</h1>
        <p className="text-gray-500 mb-8">
          Consultez et gérez la base de données des microorganismes et des produits.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("micro")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "micro"
                ? "bg-brand-primary text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:border-brand-primary"
            }`}
          >
            <Bug className="w-4 h-4" />
            Microorganismes
          </button>
          <button
            onClick={() => setActiveTab("produit")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "produit"
                ? "bg-brand-primary text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:border-brand-primary"
            }`}
          >
            <Apple className="w-4 h-4" />
            Produits
          </button>
        </div>

        {/* Microorganismes */}
        {activeTab === "micro" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <Database className="w-5 h-5 text-brand-primary" />
              <div>
                <h2 className="font-semibold text-gray-900">Base des microorganismes</h2>
                <p className="text-sm text-gray-500">{micros.length} entrées — Tref = 60 °C, Z = 7 °C par défaut</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tref (°C)</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Z (°C)</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">VP cible (min)</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {micros.map((m) => (
                    <tr key={m.id} className="hover:bg-brand-primary/5 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 italic">{m.nom}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className="bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded font-mono">
                          {m.t_ref}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className="bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded font-mono">
                          {m.z}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-mono">{m.vp_cible_min}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{m.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Produits */}
        {activeTab === "produit" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <Database className="w-5 h-5 text-brand-accent" />
              <div>
                <h2 className="font-semibold text-gray-900">Base des produits cidricoles</h2>
                <p className="text-sm text-gray-500">{produits.length} produits référencés</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Microorg. par défaut</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">VP cible (min)</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">pH typique</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {produits.map((p) => (
                    <tr key={p.id} className="hover:bg-brand-accent/5 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{p.nom}</td>
                      <td className="px-6 py-3 text-sm text-gray-600 italic">{p.microorganisme_defaut}</td>
                      <td className="px-6 py-3 text-sm font-mono">{p.vp_cible_min}</td>
                      <td className="px-6 py-3 text-sm font-mono">{p.ph_typique}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-brand-highlight/20 rounded-xl p-6 border border-brand-highlight/50">
          <h3 className="font-semibold text-gray-900 mb-2">Méthode de calcul</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              La Valeur Pasteurisatrice est calculée par la <strong>méthode de Bigelow</strong> :
            </p>
            <p className="font-mono bg-white/60 p-3 rounded-lg text-center text-base">
              VP = Σ 10<sup>(T<sub>i</sub> - T<sub>ref</sub>) / z</sup> × Δt<sub>i</sub>
            </p>
            <p>
              Avec <strong>Tref = 60 °C</strong> et <strong>Z = 7 °C</strong> par défaut pour les essais cidricoles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
