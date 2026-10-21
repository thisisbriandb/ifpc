"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, X, Loader2, Send, CheckCircle2 } from "lucide-react";
import { envoyerDemandeSupport, type CategorieSupport } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const CATEGORIES: CategorieSupport[] = ["BUG", "QUESTION", "IDEE"];
const TITRE_MAX = 120;
const DESCRIPTION_MAX = 5000;

/**
 * Help desk : la demande devient une issue GitHub, sans l'identité du
 * demandeur (le dépôt est public) — le service informatique la reçoit à part,
 * par e-mail. La page et la version sont jointes d'office : ce sont les deux
 * questions qu'on poserait de toute façon en retour.
 */
export default function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const [categorie, setCategorie] = useState<CategorieSupport>("BUG");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [numero, setNumero] = useState<number | null>(null);

  const fermer = () => {
    // Une demande envoyée ne se renvoie pas par erreur à la réouverture ; un
    // brouillon, lui, se garde.
    if (numero !== null) {
      setTitre("");
      setDescription("");
      setCategorie("BUG");
      setNumero(null);
    }
    setErreur(null);
    onClose();
  };

  const envoyer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const ticket = await envoyerDemandeSupport({
        categorie,
        titre: titre.trim(),
        description: description.trim(),
        page: pathname ?? undefined,
        version: process.env.NEXT_PUBLIC_VERSION,
      });
      setNumero(ticket.numero);
    } catch (e: any) {
      const statut = e?.response?.status;
      if (statut === 429) setErreur(t("support.errorTooMany"));
      else if (statut === 503 || statut === 502) setErreur(t("support.errorUnavailable"));
      else setErreur(e?.response?.data?.message || t("support.errorGeneric"));
    } finally {
      setEnvoi(false);
    }
  };

  if (!open) return null;

  const valide = titre.trim().length > 0 && description.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={fermer} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-titre"
        className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full mx-4 overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 id="support-titre" className="font-bold text-gray-900 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-brand-primary" />
            {t("support.title")}
          </h3>
          <button
            onClick={fermer}
            aria-label={t("support.close")}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {numero !== null ? (
          <div className="p-6 space-y-4">
            <p className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle2 className="w-5 h-5 text-brand-primary shrink-0" />
              {t("support.success", { numero })}
            </p>
            <button
              onClick={fermer}
              className="px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
            >
              {t("support.close")}
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">{t("support.intro")}</p>

            <fieldset>
              <legend className="text-xs font-semibold text-gray-600 mb-1.5">{t("support.type")}</legend>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={categorie === c}
                    onClick={() => setCategorie(c)}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                      categorie === c
                        ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary font-semibold"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {t(`support.types.${c}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="text-xs font-semibold text-gray-600">{t("support.subject")}</span>
              <input
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                maxLength={TITRE_MAX}
                placeholder={t("support.subjectPlaceholder")}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-600">{t("support.description")}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={DESCRIPTION_MAX}
                rows={6}
                placeholder={t("support.descriptionPlaceholder")}
                className="mt-1 w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
              />
            </label>

            <p className="text-[11px] text-gray-400">{t("support.privacy")}</p>

            {erreur && (
              <p role="alert" className="text-sm text-red-600">
                {erreur}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={envoyer}
                disabled={!valide || envoi}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
              >
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {envoi ? t("support.sending") : t("support.send")}
              </button>
              <button
                onClick={fermer}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t("support.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
