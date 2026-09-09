"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, BookOpen, Plus, ShieldAlert, WifiOff } from "lucide-react";

import {
  demanderReponse,
  historiquePour,
  lireSante,
  lireSuggestions,
  type AnalyseLdc,
  type IllustrationLdc,
  type LatenceLdc,
  type OutilLdc,
  type SanteLdc,
  type SourceLdc,
  type VerificationLdc,
} from "@/lib/ldc";

import AnswerMarkdown from "./AnswerMarkdown";
import Composer from "./Composer";
import EmptyState from "./EmptyState";
import Feedback from "./Feedback";
import FicheDrawer from "./FicheDrawer";
import IllustrationPanel from "./IllustrationPanel";
import SourceList from "./SourceList";
import Thinking from "./Thinking";
import ToolCard from "./ToolCard";

interface Tour {
  id: string;
  question: string;
  analyse?: AnalyseLdc;
  outil?: OutilLdc;
  sources: SourceLdc[];
  illustrations: IllustrationLdc[];
  texte: string;
  verification?: VerificationLdc;
  latence?: LatenceLdc;
  erreur?: string;
  termine: boolean;
}

const tourVide = (question: string): Tour => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  question,
  sources: [],
  illustrations: [],
  texte: "",
  termine: false,
});

/** Étape en cours, déduite des événements reçus — jamais d'une minuterie. */
function etapeDe(tour: Tour): "analyse" | "recherche" | "redaction" {
  if (!tour.analyse) return "analyse";
  if (!tour.sources.length) return "recherche";
  return "redaction";
}

export default function AssistantChat() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sante, setSante] = useState<SanteLdc | null>(null);
  const [ficheOuverte, setFicheOuverte] = useState<number | null>(null);
  const [citation, setCitation] = useState<number | null>(null);

  const abandon = useRef<AbortController | null>(null);
  const fil = useRef<HTMLDivElement>(null);
  const dernierTour = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const a = new AbortController();
    lireSuggestions(a.signal).then(setSuggestions).catch(() => undefined);
    lireSante(a.signal).then(setSante);
    return () => a.abort();
  }, []);

  /**
   * Amène la question envoyée en haut du fil ; la réponse se déroule dessous.
   *
   * Un seul défilement, au moment de l'envoi. Coller le fil à son bas pendant
   * le streaming — le réflexe habituel d'un chat — faisait sortir la réponse
   * par le haut dès qu'un schéma arrivait : l'utilisateur voyait l'image, pas
   * le texte qu'il attendait.
   */
  const remonterLaQuestion = () => {
    requestAnimationFrame(() =>
      dernierTour.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const majDernier = useCallback((transforme: (t: Tour) => Tour) => {
    setTours((liste) =>
      liste.map((t, i) => (i === liste.length - 1 ? transforme(t) : t)));
  }, []);

  const poser = useCallback(
    async (question: string) => {
      const propre = question.trim();
      if (!propre || enCours) return;

      const precedents = tours
        .filter((t) => t.termine && !t.erreur)
        .map((t) => ({ question: t.question, reponse: t.texte }));

      setSaisie("");
      setEnCours(true);
      setTours((liste) => [...liste, tourVide(propre)]);
      remonterLaQuestion();

      const controleur = new AbortController();
      abandon.current = controleur;

      try {
        await demanderReponse(
          { question: propre, historique: historiquePour(precedents), signal: controleur.signal },
          (ev) => {
            switch (ev.type) {
              case "analyse":
                majDernier((t) => ({ ...t, analyse: ev.analyse }));
                break;
              case "outil":
                majDernier((t) => ({ ...t, outil: ev.outil }));
                break;
              case "sources":
                majDernier((t) => ({ ...t, sources: ev.passages }));
                break;
              case "illustrations":
                majDernier((t) => ({ ...t, illustrations: ev.illustrations }));
                break;
              case "delta":
                majDernier((t) => ({ ...t, texte: t.texte + ev.texte }));
                break;
              case "fin":
                majDernier((t) => ({
                  ...t, termine: true,
                  verification: ev.verification, latence: ev.latence,
                }));
                break;
              case "erreur":
                majDernier((t) => ({ ...t, termine: true, erreur: ev.message }));
                break;
            }
          },
        );
      } catch (e: any) {
        // L'abandon volontaire (bouton « arrêter ») n'est pas une panne.
        const interrompu = e?.name === "AbortError";
        majDernier((t) => ({
          ...t,
          termine: true,
          erreur: interrompu ? undefined : "Le service n'a pas répondu. Réessayez dans un instant.",
        }));
      } finally {
        majDernier((t) => ({ ...t, termine: true }));
        setEnCours(false);
        abandon.current = null;
      }
    },
    [enCours, majDernier, tours],
  );

  const arreter = () => abandon.current?.abort();

  const ouvrirCitation = (source: SourceLdc) => {
    setCitation(source.index);
    setFicheOuverte(source.fiche_idoc);
  };

  const nouvelleConversation = () => {
    abandon.current?.abort();
    setTours([]);
    setSaisie("");
  };

  const indisponible = sante !== null && !sante.generation;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-brand-gray lg:h-screen">
      {/* En-tête */}
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b
        border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl
            bg-brand-primary/10 text-brand-primary">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-semibold text-brand-text">
              Assistant du Livre de Connaissances
            </h1>
            <p className="truncate text-[11px] text-gray-400">
              {sante
                ? `AsCoCid · ${sante.corpus.fiche} fiches · recherche ${sante.recherche}`
                : "AsCoCid — IFPC / INRAE"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(sante === null || indisponible) && (
            <span className="hidden items-center gap-1.5 rounded-lg bg-brand-accent/10 px-2 py-1
              text-[11px] text-brand-accent sm:flex">
              <WifiOff className="h-3 w-3" />
              {indisponible ? "rédaction indisponible" : "service injoignable"}
            </span>
          )}
          {tours.length > 0 && (
            <button
              onClick={nouvelleConversation}
              aria-label="Nouvelle question"
              className="flex items-center gap-1.5 rounded-xl border border-gray-100 px-2.5 py-1.5
                text-[12px] text-gray-500 transition-colors hover:border-brand-primary/30
                hover:text-brand-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nouvelle question</span>
            </button>
          )}
        </div>
      </header>

      {/* Fil */}
      <div ref={fil} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6">
          {tours.length === 0 ? (
            <EmptyState
              suggestions={suggestions}
              onChoisir={poser}
              fiches={sante?.corpus.fiche ?? 0}
            />
          ) : (
            <div className="space-y-8 py-8">
              <AnimatePresence initial={false}>
                {tours.map((tour, rang) => (
                  <motion.article
                    key={tour.id}
                    ref={rang === tours.length - 1
                      ? (el: HTMLElement | null) => { dernierTour.current = el; }
                      : undefined}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`space-y-4 ${
                      rang === tours.length - 1 ? "min-h-[calc(100vh-13rem)]" : ""}`}
                  >
                    <div className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md
                        bg-white px-4 py-2.5 text-[14px] leading-relaxed text-brand-text
                        shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
                        {tour.question}
                      </p>
                    </div>

                    <div className="min-w-0">
                      {tour.outil && <ToolCard outil={tour.outil} />}

                      {tour.verification?.bloquee && (
                        <div className="mb-3 flex items-start gap-2 rounded-xl border
                          border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            Cette réponse n&apos;a pas passé le contrôle de traçabilité : une valeur
                            ou une citation n&apos;a pas été retrouvée dans les passages. À vérifier
                            dans les sources avant toute décision.
                          </span>
                        </div>
                      )}

                      {tour.texte ? (
                        <AnswerMarkdown
                          texte={tour.texte}
                          sources={tour.sources}
                          onCitation={ouvrirCitation}
                        />
                      ) : tour.erreur ? null : (
                        <Thinking etape={etapeDe(tour)} />
                      )}

                      {tour.erreur && (
                        <div className="flex items-start gap-2 rounded-xl border border-gray-100
                          bg-white px-3 py-2.5 text-[13px] text-gray-600">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
                          <span className="flex-1">{tour.erreur}</span>
                          <button
                            onClick={() => poser(tour.question)}
                            className="shrink-0 text-[12px] font-medium text-brand-primary
                              hover:underline"
                          >
                            Réessayer
                          </button>
                        </div>
                      )}

                      {tour.verification?.tronquee && (
                        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-brand-accent">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          Réponse interrompue avant sa fin — reformulez la question ou
                          consultez directement les sources ci-dessous.
                        </p>
                      )}

                      {tour.verification?.alertes
                        .filter((a) => a.gravite === "avertissement")
                        .slice(0, 2)
                        .map((a) => (
                          <p key={a.code} className="mt-2 flex items-start gap-1.5 text-[11px]
                            text-brand-accent">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            {a.detail}
                          </p>
                        ))}

                      <SourceList
                        sources={tour.sources}
                        surligne={citation}
                        onOuvrir={ouvrirCitation}
                      />

                      {/* Les illustrations arrivent avant le texte, mais les
                          afficher tout de suite remplirait l'écran d'une image
                          pendant que la réponse se fait attendre : la réponse
                          d'abord (spec 07 §1). */}
                      {(tour.texte || tour.termine) && (
                        <IllustrationPanel
                          illustrations={tour.illustrations}
                          onOuvrirFiche={setFicheOuverte}
                        />
                      )}

                      {tour.termine && tour.texte && !tour.erreur && (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Feedback
                            question={tour.question}
                            reponse={tour.texte}
                            sources={tour.sources.map((s) => s.fiche_idoc)}
                          />
                          {tour.latence && (
                            <span className="text-[11px] text-gray-300">
                              {(tour.latence.total_ms / 1000).toFixed(1).replace(".", ",")} s
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Saisie */}
      <div className="shrink-0 bg-gradient-to-t from-brand-gray via-brand-gray to-transparent
        px-4 pb-4 pt-2 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            valeur={saisie}
            onChange={setSaisie}
            onEnvoyer={() => poser(saisie)}
            onArreter={arreter}
            enCours={enCours}
            placeholder="Posez une question sur le cidre, un procédé, une étape…"
          />
          <p className="mt-2 text-center text-[11px] text-gray-400">
            Les réponses proviennent du Livre de Connaissances AsCoCid et citent leurs sources.
            <span className="hidden sm:inline">
              {" "}Pour un calcul sur vos propres lots, l&apos;assistant renvoie vers
              l&apos;outil concerné.
            </span>
          </p>
        </div>
      </div>

      <FicheDrawer idoc={ficheOuverte} onFermer={() => setFicheOuverte(null)} />
    </div>
  );
}
