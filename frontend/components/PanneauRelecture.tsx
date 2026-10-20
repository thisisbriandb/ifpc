"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Loader2, Plus, Search, Trash2,
  ZoomIn, ZoomOut,
} from "lucide-react";
import {
  corrigerTranscription, lireTranscription, listerTranscriptions,
  type ResumeTranscription, type RubriqueTranscription, type StatutTranscription,
  type Transcription,
} from "@/lib/ldc";

/**
 * Relecture des illustrations transcrites par OCR (fiches de variété, figures).
 *
 * L'image d'origine fait foi : la page la montre à côté du texte extrait, et
 * signale les mots dont l'OCR doute. Une correction enregistrée met aussitôt
 * à jour ce que l'assistant sait de la fiche.
 *
 * Les transcriptions « à vérifier » sont déjà utilisées par l'assistant, sauf
 * celles que l'OCR a trop mal lues (un tableau aux colonnes mélangées) : elles
 * n'y entrent qu'une fois corrigées. Ce sont les premières à traiter.
 */

const LIBELLES: Record<StatutTranscription, string> = {
  a_verifier: "À vérifier",
  corrige: "Corrigée",
  valide: "Validée",
};

const COULEURS: Record<StatutTranscription, string> = {
  a_verifier: "bg-amber-50 text-amber-700",
  corrige: "bg-sky-50 text-sky-700",
  valide: "bg-emerald-50 text-emerald-700",
};

const FAMILLES: Record<string, string> = {
  FDC: "Fiches de variété", FICHE: "Illustrations d'articles", CMAP: "Cartes conceptuelles",
};

function Statut({ statut }: { statut: StatutTranscription }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${COULEURS[statut]}`}>
      {LIBELLES[statut]}
    </span>
  );
}

export default function PanneauRelecture() {
  const [liste, setListe] = useState<ResumeTranscription[]>([]);
  const [erreursFichiers, setErreursFichiers] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<StatutTranscription | "">("a_verifier");
  const [filtreFamille, setFiltreFamille] = useState("");
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);

  useEffect(() => {
    listerTranscriptions()
      .then((r) => { setListe(r.transcriptions); setErreursFichiers(r.erreurs); })
      .catch((e) => setErreur(e instanceof Error ? e.message : "Chargement impossible."))
      .finally(() => setChargement(false));
  }, []);

  // Les illisibles d'abord (absentes de l'assistant), puis les plus douteuses.
  const visibles = useMemo(() => liste
    .filter((t) => !filtreStatut || t.statut === filtreStatut)
    .filter((t) => !filtreFamille || t.famille === filtreFamille)
    .filter((t) => !recherche || t.titre.toLowerCase().includes(recherche.toLowerCase()))
    .sort((a, b) => Number(a.indexee) - Number(b.indexee) || b.douteux - a.douteux),
  [liste, filtreStatut, filtreFamille, recherche]);

  const compte = (s: StatutTranscription) => liste.filter((t) => t.statut === s).length;

  const apresEnregistrement = (t: Transcription) => {
    setListe((prev) => prev.map((x) => x.code === t.code ? {
      ...x, titre: t.titre, statut: t.statut, verifie_par: t.verifie_par,
      verifie_le: t.verifie_le, indexee: true,
      douteux: t.rubriques.reduce((n, r) => n + r.lignes.reduce((m, l) => m + l.douteux.length, 0), 0),
    } : x));
  };

  const suivante = (code: string) => {
    const i = visibles.findIndex((t) => t.code === code);
    const prochaine = visibles.slice(i + 1).find((t) => t.statut === "a_verifier");
    setOuverte(prochaine?.code ?? null);
  };

  if (chargement) {
    return <div className="py-20 text-center"><Loader2 className="w-6 h-6 text-gray-300 mx-auto animate-spin" /></div>;
  }

  if (ouverte) {
    return (
      <EditeurTranscription
        key={ouverte}
        code={ouverte}
        onRetour={() => setOuverte(null)}
        onEnregistree={apresEnregistrement}
        onSuivante={() => suivante(ouverte)}
      />
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <p className="text-sm text-gray-500 mb-6 max-w-3xl">
        Les fiches de variété et les figures du Livre ne sont que des images : leur texte a été
        lu par OCR. Comparez-le à l&apos;image et corrigez-le — les mots dont la lecture est
        incertaine sont signalés. Une fiche corrigée est aussitôt mise à jour dans l&apos;assistant.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        {(["a_verifier", "corrige", "valide"] as StatutTranscription[]).map((s) => (
          <button key={s} onClick={() => setFiltreStatut(filtreStatut === s ? "" : s)}
            className={`rounded-lg border px-3 py-1.5 font-semibold ${filtreStatut === s
              ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"}`}>
            {LIBELLES[s]} · {compte(s)}
          </button>
        ))}
        <select value={filtreFamille} onChange={(e) => setFiltreFamille(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-600">
          <option value="">Toutes les familles</option>
          {Object.entries(FAMILLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-300" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher"
            className="rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 focus:border-gray-400 focus:outline-none" />
        </label>
      </div>

      {(erreur || erreursFichiers.length > 0) && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
          {erreursFichiers.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">Aucune transcription dans ce filtre.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((t) => (
            <li key={t.code}>
              <button onClick={() => setOuverte(t.code)}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200
                  bg-white px-5 py-3 text-left transition-colors hover:border-gray-300">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-gray-900">{t.titre}</span>
                    <Statut statut={t.statut} />
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-400">
                    {FAMILLES[t.famille] ?? t.famille}
                    {t.douteux > 0 && ` · ${t.douteux} mot${t.douteux > 1 ? "s" : ""} à vérifier`}
                    {t.verifie_par && ` · relue par ${t.verifie_par}`}
                  </span>
                  {!t.indexee && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Lecture trop incertaine : absente de l&apos;assistant tant qu&apos;elle n&apos;est pas corrigée
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditeurTranscription({
  code, onRetour, onEnregistree, onSuivante,
}: {
  code: string;
  onRetour: () => void;
  onEnregistree: (t: Transcription) => void;
  onSuivante: () => void;
}) {
  const [t, setT] = useState<Transcription | null>(null);
  const [titre, setTitre] = useState("");
  const [rubriques, setRubriques] = useState<RubriqueTranscription[]>([]);
  const [zoom, setZoom] = useState(false);
  const [brut, setBrut] = useState(false);
  const [envoi, setEnvoi] = useState<"" | "corrige" | "valide">("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    const abandon = new AbortController();
    lireTranscription(code, abandon.signal)
      .then((x) => { setT(x); setTitre(x.titre); setRubriques(x.rubriques); })
      .catch((e) => { if (e.name !== "AbortError") setMessage({ ok: false, texte: e.message }); });
    return () => abandon.abort();
  }, [code]);

  const modifier = useCallback(
    (r: number, l: number | null, champs: Partial<RubriqueTranscription & { intitule: string; valeur: string; douteux: string[] }>) => {
      setRubriques((prev) => prev.map((rub, i) => {
        if (i !== r) return rub;
        if (l === null) return { ...rub, ...champs };
        return { ...rub, lignes: rub.lignes.map((lig, j) => j === l ? { ...lig, ...champs } : lig) };
      }));
    }, []);

  const enregistrer = async (statut: "corrige" | "valide") => {
    setEnvoi(statut);
    setMessage(null);
    try {
      // Valider, c'est attester que tout a été comparé à l'image : plus rien n'est douteux.
      const contenu = statut === "valide"
        ? rubriques.map((r) => ({ ...r, lignes: r.lignes.map((l) => ({ ...l, douteux: [] })) }))
        : rubriques;
      const maj = await corrigerTranscription(code, { titre, statut, rubriques: contenu });
      setT(maj);
      setRubriques(maj.rubriques);
      onEnregistree(maj);
      setMessage({ ok: true, texte: statut === "valide"
        ? "Fiche validée — l'assistant est à jour." : "Corrections enregistrées — l'assistant est à jour." });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof Error ? e.message : "Enregistrement refusé." });
    } finally {
      setEnvoi("");
    }
  };

  const carte = code.startsWith("CMAP_");

  if (!t) {
    return message
      ? <p className="py-12 text-center text-sm text-red-600">{message.texte}</p>
      : <div className="py-20 text-center"><Loader2 className="w-6 h-6 text-gray-300 mx-auto animate-spin" /></div>;
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onRetour} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </button>
        <span className="flex items-center gap-2 text-xs text-gray-400">
          <Statut statut={t.statut} />
          Qualité de lecture {Math.round(t.qualite_ocr)} / 100
          {t.verifie_par && ` · relue par ${t.verifie_par}`}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Image d'origine : elle fait foi. */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex justify-end">
            <button onClick={() => setZoom((z) => !z)} className="flex items-center gap-1 text-xs font-semibold text-gray-500">
              {zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              {zoom ? "Ajuster" : "Agrandir"}
            </button>
          </div>
          <div className="max-h-[80vh] overflow-auto rounded-xl border border-gray-200 bg-white">
            <img src={t.image} alt={`Image d'origine : ${t.titre}`} className={zoom ? "max-w-none w-[200%]" : "w-full"} />
          </div>
        </div>

        {/* Texte extrait, modifiable. */}
        <div className="flex flex-col gap-4">
          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-500">Titre</span>
            <input value={titre} onChange={(e) => setTitre(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:border-gray-400 focus:outline-none" />
          </label>

          {t.anomalies && t.anomalies.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">À vérifier en priorité :</p>
              {t.anomalies.map((a) => <p key={a}>{a}</p>)}
            </div>
          )}

          {rubriques.map((r, i) => (
            <section key={i} className="rounded-xl border border-gray-200 bg-white p-4">
              <input value={r.titre} onChange={(e) => modifier(i, null, { titre: e.target.value })}
                placeholder="Titre de la rubrique"
                className="mb-1 w-full border-0 p-0 text-sm font-bold text-gray-900 focus:outline-none" />
              {r.ordonnee && (
                <p className="mb-1 text-[11px] font-semibold text-sky-700">
                  Suite ordonnée (cases reliées par des flèches) — garder l&apos;ordre de l&apos;image.
                </p>
              )}
              <input value={r.note} onChange={(e) => modifier(i, null, { note: e.target.value })}
                placeholder="Note (facultatif)"
                className="mb-3 w-full border-0 p-0 text-xs italic text-gray-500 focus:outline-none" />
              <div className="flex flex-col gap-2">
                {r.lignes.map((l, j) => (
                  <div key={j} className={`rounded-lg border p-2 ${l.douteux.length ? "border-amber-300 bg-amber-50/40" : "border-gray-100"}`}>
                    <div className="flex gap-2">
                      <input value={l.intitule} onChange={(e) => modifier(i, j, { intitule: e.target.value })}
                        placeholder={carte ? "Case parente (vide : premier niveau)" : "Intitulé (vide : paragraphe)"}
                        className="w-2/5 rounded border border-gray-200 px-2 py-1 text-xs focus:border-gray-400 focus:outline-none" />
                      <textarea value={l.valeur} onChange={(e) => modifier(i, j, { valeur: e.target.value })}
                        rows={Math.min(5, Math.ceil(l.valeur.length / 45) || 1)}
                        className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-gray-400 focus:outline-none" />
                      <button title="Supprimer la ligne"
                        onClick={() => setRubriques((prev) => prev.map((rub, k) => k !== i ? rub
                          : { ...rub, lignes: rub.lignes.filter((_, m) => m !== j) }))}
                        className="self-start p-1 text-gray-300 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {l.douteux.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-amber-700">À vérifier sur l&apos;image :</span>
                        {l.douteux.map((d, k) => (
                          <code key={k} className="rounded bg-amber-100 px-1 text-amber-900">{d}</code>
                        ))}
                        <button onClick={() => modifier(i, j, { douteux: [] })}
                          className="ml-auto font-semibold text-emerald-700 hover:underline">
                          Vérifié
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={() => modifier(i, null, { lignes: [...r.lignes, { intitule: "", valeur: "", douteux: [] }] })}
                  className="flex items-center gap-1 self-start text-xs font-semibold text-gray-400 hover:text-gray-700">
                  <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
                </button>
              </div>
            </section>
          ))}
          <button onClick={() => setRubriques((prev) => [...prev, { titre: "", note: "", lignes: [] }])}
            className="flex items-center gap-1 self-start text-xs font-semibold text-gray-400 hover:text-gray-700">
            <Plus className="h-3.5 w-3.5" /> Ajouter une rubrique
          </button>

          <button onClick={() => setBrut((b) => !b)} className="self-start text-xs text-gray-400 hover:text-gray-700">
            {brut ? "Masquer" : "Voir"} le texte brut de l&apos;OCR
          </button>
          {brut && <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[11px] text-gray-500">{t.texte_ocr}</pre>}

          {message && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${message.ok
              ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {message.ok && <CheckCircle2 className="h-4 w-4" />} {message.texte}
            </div>
          )}

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-100 bg-[#F8F9FA] py-3">
            <button onClick={() => enregistrer("corrige")} disabled={!!envoi}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
              {envoi === "corrige" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer (corrigée)"}
            </button>
            <button onClick={() => enregistrer("valide")} disabled={!!envoi}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {envoi === "valide" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider : conforme à l'image"}
            </button>
            <button onClick={onSuivante} className="ml-auto text-sm font-semibold text-gray-500 hover:text-gray-900">
              Suivante à vérifier →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
