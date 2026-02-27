"use client";

import { CheckCircle, AlertTriangle, XCircle, ShieldAlert } from "lucide-react";

interface RisqueData {
  niveau: string;
  score: number;
  couleur: string;
  conseil: string;
}

interface ResultData {
  vp: number;
  vp_cible: number;
  statut: string;
  message: string;
  risque: RisqueData;
  parametres: {
    t_ref: number;
    z: number;
    microorganisme: string;
    produit: string;
    clarification: string | null;
    procede: string | null;
  };
}

interface Props {
  result: ResultData;
}

export default function ResultDisplay({ result }: Props) {
  const statutConfig: Record<string, { icon: any; bg: string; border: string; text: string }> = {
    conforme: {
      icon: CheckCircle,
      bg: "bg-green-50",
      border: "border-brand-primary",
      text: "text-brand-primary",
    },
    vigilance: {
      icon: AlertTriangle,
      bg: "bg-amber-50",
      border: "border-brand-accent",
      text: "text-brand-accent",
    },
    insuffisant: {
      icon: XCircle,
      bg: "bg-red-50",
      border: "border-red-500",
      text: "text-red-600",
    },
  };

  const cfg = statutConfig[result.statut] || statutConfig.insuffisant;
  const Icon = cfg.icon;

  return (
    <div className="space-y-4">
      {/* Diagnostic principal */}
      <div className={`${cfg.bg} border-2 ${cfg.border} rounded-xl p-6`}>
        <div className="flex items-start gap-4">
          <Icon className={`w-8 h-8 ${cfg.text} flex-shrink-0`} />
          <div className="flex-1">
            <h3 className={`text-xl font-bold ${cfg.text} mb-1`}>
              {result.statut === "conforme" && "Pasteurisation conforme"}
              {result.statut === "vigilance" && "Vigilance requise"}
              {result.statut === "insuffisant" && "Pasteurisation insuffisante"}
            </h3>
            <p className="text-gray-700">{result.message}</p>
          </div>
        </div>

        {/* VP bar */}
        <div className="mt-4 bg-white/60 rounded-lg p-4">
          <div className="flex justify-between text-sm font-medium mb-2">
            <span>VP obtenue</span>
            <span className={`${cfg.text} font-bold text-lg`}>{result.vp.toFixed(2)} UP</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((result.vp / result.vp_cible) * 100, 100)}%`,
                backgroundColor: result.risque.couleur,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span className="font-medium">Cible : {result.vp_cible} UP</span>
          </div>
        </div>
      </div>

      {/* Indicateur de risque */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <ShieldAlert className="w-5 h-5 text-gray-500" />
          <h4 className="font-semibold text-gray-900">Niveau de risque</h4>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: result.risque.couleur }}
          />
          <div>
            <span className="font-bold capitalize" style={{ color: result.risque.couleur }}>
              {result.risque.niveau}
            </span>
            <p className="text-sm text-gray-600 mt-0.5">{result.risque.conseil}</p>
          </div>
        </div>
      </div>

      {/* Paramètres utilisés */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h4 className="font-semibold text-gray-900 mb-3">Paramètres utilisés</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Produit</span>
            <p className="font-medium">{result.parametres.produit}</p>
          </div>
          <div>
            <span className="text-gray-500">Microorganisme</span>
            <p className="font-medium">{result.parametres.microorganisme}</p>
          </div>
          <div>
            <span className="text-gray-500">Tref</span>
            <p className="font-medium">{result.parametres.t_ref} °C</p>
          </div>
          <div>
            <span className="text-gray-500">Z</span>
            <p className="font-medium">{result.parametres.z} °C</p>
          </div>
          {result.parametres.clarification && (
            <div>
              <span className="text-gray-500">Clarification</span>
              <p className="font-medium capitalize">{result.parametres.clarification}</p>
            </div>
          )}
          {result.parametres.procede && (
            <div>
              <span className="text-gray-500">Procédé</span>
              <p className="font-medium">{result.parametres.procede}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
