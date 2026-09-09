"use client";

import { useState } from "react";
import { ChevronDown, FileSpreadsheet, HelpCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Aide au format de fichier attendu à l'import d'un relevé.
 *
 * Demande d'un testeur producteur : « il pourrait être bien d'ajouter une aide
 * avec la structure demandée. Faut-il des en-têtes ? Dans quel ordre mettre les
 * colonnes ? Quel délimiteur ? »
 *
 * Le contenu décrit ce que le moteur accepte réellement — séparateurs détectés,
 * intitulés reconnus, formats de date, virgule décimale. Le tenir à jour fait
 * partie du contrat : une aide fausse coûte plus qu'une aide absente.
 */
export default function AideImport() {
  const { t } = useI18n();
  const [ouvert, setOuvert] = useState(false);

  const exemple = [
    "Temps (min);Température (°C)",
    "0;20,4",
    "1;45,1",
    "5;64,0",
    "10;64,2",
  ].join("\n");

  const Rubrique = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
    <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{titre}</p>
      <div className="text-[11px] text-gray-600 leading-relaxed space-y-1">{children}</div>
    </div>
  );

  return (
    <div className="mt-3 border border-black/[0.06] rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-50 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5 text-brand-primary shrink-0" />
        <span className="text-[11px] font-semibold text-gray-700 flex-1">
          {t("controle.importHelpTitle")}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${ouvert ? "rotate-180" : ""}`}
        />
      </button>

      <div hidden={!ouvert} className="px-3 pb-3 pt-1 space-y-3 border-t border-black/[0.04]">
        <Rubrique titre={t("controle.importHelpColumns")}>
          <p>{t("controle.importHelpColumnsText")}</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <span className="font-semibold">{t("controle.importHelpTimeCol")}</span>{" "}
              <code className="font-mono">Temps</code>, <code className="font-mono">Durée</code>,{" "}
              <code className="font-mono">Time</code>, <code className="font-mono">Date / Heure</code>,{" "}
              <code className="font-mono">Horodatage</code>
            </li>
            <li>
              <span className="font-semibold">{t("controle.importHelpTempCol")}</span>{" "}
              <code className="font-mono">Température</code>, <code className="font-mono">Temp</code>,{" "}
              <code className="font-mono">T°</code>, <code className="font-mono">°C</code>
            </li>
          </ul>
          <p>{t("controle.importHelpUnnamed")}</p>
          <p>{t("controle.importHelpOrder")}</p>
        </Rubrique>

        <Rubrique titre={t("controle.importHelpSeparator")}>
          <p>{t("controle.importHelpSeparatorText")}</p>
          <p>{t("controle.importHelpDecimal")}</p>
        </Rubrique>

        <Rubrique titre={t("controle.importHelpDates")}>
          <p>{t("controle.importHelpDatesText")}</p>
          <p className="font-mono text-[10px] text-gray-500">
            25/09/2026 15:06:01 · 2026-09-25 15:06:01 · 25/sept/2026 15:06
          </p>
          <p>{t("controle.importHelpDatesUnit")}</p>
        </Rubrique>

        <Rubrique titre={t("controle.importHelpExample")}>
          <pre className="font-mono text-[10px] bg-gray-50 border border-gray-100 rounded p-2 overflow-x-auto leading-relaxed">
            {exemple}
          </pre>
          <p className="flex items-start gap-1.5 pt-0.5">
            <FileSpreadsheet className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
            <span>{t("controle.importHelpFormats")}</span>
          </p>
        </Rubrique>
      </div>
    </div>
  );
}
