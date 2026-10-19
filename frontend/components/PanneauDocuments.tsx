"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import {
  BASE_LDC, envoyerDocument, listerDocuments, retirerDocument, type DocumentAdmin,
} from "@/lib/ldc";

/**
 * Ajouter des documents à l'assistant du Livre de Connaissances.
 *
 * Un document envoyé ici est lu tout de suite : un scan, un format inconnu ou
 * un doublon est refusé avec la raison, avant que rien ne soit enregistré.
 * Accepté, il est découpé et indexé en tâche de fond (quelques secondes à une
 * minute selon sa taille), puis l'assistant s'en sert pour répondre à tous les
 * utilisateurs, en le citant comme « Document IFPC ».
 *
 * Seuls des documents publics doivent être ajoutés : leurs passages sont
 * transmis au modèle de langage qui rédige les réponses.
 */
const SONDAGE_MS = 3000;

function taille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export default function PanneauDocuments() {
  const [documents, setDocuments] = useState<DocumentAdmin[]>([]);
  const [tailleMax, setTailleMax] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [fichier, setFichier] = useState<File | null>(null);
  const [titre, setTitre] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aRetirer, setARetirer] = useState<number | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  const recharger = useCallback(async () => {
    try {
      const r = await listerDocuments();
      setDocuments(r.documents);
      setTailleMax(r.taille_max);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  // Tant qu'un document est en cours d'intégration, la liste se rafraîchit
  // seule : l'administrateur voit passer « En cours » à « Disponible ».
  const enCours = documents.some((d) => d.etat === "en_cours");
  useEffect(() => {
    if (!enCours) return;
    const minuteur = setInterval(recharger, SONDAGE_MS);
    return () => clearInterval(minuteur);
  }, [enCours, recharger]);

  const envoyer = async () => {
    if (!fichier) return;
    if (tailleMax && fichier.size > tailleMax) {
      setErreur(`Le fichier dépasse ${taille(tailleMax)}.`);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await envoyerDocument(fichier, titre);
      setFichier(null);
      setTitre("");
      if (champFichier.current) champFichier.current.value = "";
      await recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi refusé.");
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (idoc: number) => {
    setErreur(null);
    try {
      await retirerDocument(idoc);
      setDocuments((prev) => prev.filter((d) => d.idoc !== idoc));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Retrait impossible.");
    } finally {
      setARetirer(null);
    }
  };

  if (chargement) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="w-6 h-6 text-gray-300 mx-auto animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Les documents ajoutés ici complètent le Livre de Connaissances AsCoCid :
        l&apos;assistant s&apos;en sert pour répondre à tous les utilisateurs et
        les cite comme « Document IFPC ». N&apos;ajoutez que des documents
        publics — leurs passages sont transmis au modèle qui rédige les réponses.
      </p>

      {/* --- AJOUT --- */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-semibold text-gray-500 mb-1.5">
              Fichier PDF ou Word (.docx){tailleMax ? `, ${taille(tailleMax)} au plus` : ""}
            </span>
            <input
              ref={champFichier}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => { setFichier(e.target.files?.[0] ?? null); setErreur(null); }}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
                file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold
                file:text-gray-700 hover:file:bg-gray-200"
            />
          </label>
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-semibold text-gray-500 mb-1.5">
              Titre affiché (facultatif — sinon celui du document)
            </span>
            <input
              type="text"
              value={titre}
              maxLength={200}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. : Guide de la clarification 2026"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                focus:border-gray-400 focus:outline-none"
            />
          </label>
          <button
            onClick={envoyer}
            disabled={!fichier || envoi}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2
              text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {envoi ? "Lecture…" : "Ajouter"}
          </button>
        </div>
      </div>

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* --- LISTE --- */}
      {documents.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          Aucun document ajouté. L&apos;assistant répond à partir du seul Livre AsCoCid.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((d) => (
            <li
              key={d.idoc}
              className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white px-5 py-4"
            >
              <div className="flex min-w-0 gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />
                <div className="min-w-0">
                  <a
                    href={`${BASE_LDC}/document/${d.idoc}/fichier`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-gray-900 hover:underline"
                  >
                    {d.titre}
                  </a>
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {d.nom_fichier} · {taille(d.octets)} · ajouté le{" "}
                    {new Date(d.ajoute_le).toLocaleDateString(undefined, {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                    {d.ajoute_par ? ` par ${d.ajoute_par}` : ""}
                  </p>
                  {/* L'état en toutes lettres, pas seulement en couleur. */}
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold">
                    {d.etat === "pret" && (
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Disponible pour l&apos;assistant · {d.passages} passage{d.passages > 1 ? "s" : ""}
                      </span>
                    )}
                    {d.etat === "en_cours" && (
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        En cours d&apos;intégration…
                      </span>
                    )}
                    {d.etat === "erreur" && (
                      <span className="flex items-center gap-1.5 text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Échec — {d.message || "intégration impossible"}. Retirez-le puis ajoutez-le à nouveau.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {aRetirer === d.idoc ? (
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <button
                    onClick={() => retirer(d.idoc)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white"
                  >
                    Retirer
                  </button>
                  <button
                    onClick={() => setARetirer(null)}
                    className="rounded-lg px-3 py-1.5 font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setARetirer(d.idoc)}
                  title="Retirer ce document de l'assistant"
                  className="shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
