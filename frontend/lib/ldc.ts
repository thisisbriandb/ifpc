/**
 * Client du chatbot « Livre de Connaissances » (backend/rag_ascocid).
 *
 * Le service répond en SSE et non en JSON : les sources et les illustrations
 * arrivent AVANT le premier mot rédigé (spec 07 §2). C'est ce qui rend
 * l'attente supportable — le modèle met plusieurs secondes, la page a de quoi
 * s'afficher au bout de deux cents millisecondes.
 *
 * Le découpage réseau ne respecte aucune frontière d'événement : un `data:`
 * peut être coupé en deux paquets. Le tampon ci-dessous est donc la pièce
 * critique du fichier, et la seule qui soit testée isolément.
 */

// ── Contrat d'événements (miroir de interfaces/web/api.py) ───────────────────

export interface AnalyseLdc {
  intention: "corpus" | "lookup" | "navigation" | "outil" | "conversation" | "clarification";
  requete_recherche: string;
  outil_suggere: string | null;
  entites: Record<string, string>;
  confiance: number;
  origine: string;
  duree_ms: number;
}

export interface OutilLdc {
  id: string;
  nom: string;
  url: string;
  objet: string;
}

export interface SourceLdc {
  index: number;
  fiche_idoc: number;
  titre_fiche: string;
  titre_section: string;
  terme: string;
  origine: "lexical" | "dense" | "fusion" | "graphe" | string;
  url: string;
}

export interface ZoneLdc {
  libelle: string;
  cible_idoc: number;
  x_pct: number;
  y_pct: number;
  taille_pct: number;
  active: boolean;
}

export interface IllustrationLdc {
  fiche_idoc: number;
  nature: "schema" | "planche" | "figure";
  legende: string;
  url: string;
  format: "svg" | "png";
  largeur: number;
  hauteur: number;
  orientation: "paysage" | "portrait" | "carre" | "";
  octets: number;
  essentielle: boolean;
  zones: ZoneLdc[];
}

export interface AlerteLdc {
  gravite: "bloquante" | "avertissement";
  code: string;
  detail: string;
}

export interface VerificationLdc {
  bloquee: boolean;
  /** Le modèle a été coupé avant la fin (budget de sortie atteint). */
  tronquee?: boolean;
  alertes: AlerteLdc[];
}

export interface LatenceLdc {
  analyse_ms: number;
  ttft_ms: number;
  total_ms: number;
}

export interface UsageLdc {
  entree: number;
  cache_lu: number;
  cache_ecrit: number;
  sortie: number;
  cout_usd: number;
}

export type EvenementLdc =
  | { type: "analyse"; analyse: AnalyseLdc }
  | { type: "outil"; outil: OutilLdc }
  | { type: "sources"; passages: SourceLdc[] }
  | { type: "illustrations"; illustrations: IllustrationLdc[] }
  | { type: "delta"; texte: string }
  | { type: "fin"; verification: VerificationLdc; latence: LatenceLdc; usage: UsageLdc | null }
  | { type: "erreur"; code: string; message: string };

export interface BlocFiche {
  type: string;
  titre_section: string;
  terme: string;
  texte: string;
}

export interface FicheLdc {
  idoc: number;
  code: string;
  type: string;
  titre: string;
  modifie_le: string;
  auteurs: { statut: string; affiliation: string; courriel: string }[];
  source_url: string;
  illustration: string;
  blocs: BlocFiche[];
  carte: {
    largeur: number;
    hauteur: number;
    zones: { libelle: string; cible_idoc: number; x_pct: number; y_pct: number }[];
  } | null;
  voir_aussi: { idoc: number; titre: string }[];
}

export interface SanteLdc {
  corpus: Record<string, number>;
  chunks: number;
  recherche: "hybride" | "lexicale";
  generation: boolean;
  modeles: { analyse: string; redaction: string };
  chargement_s: number;
}

/**
 * Où joindre le service de réponse.
 *
 * Par défaut, le proxy du front (`/api/ldc/*` → `LDC_URL`, cf. next.config.mjs) :
 * même origine, aucun CORS, le jeton ne quitte pas le domaine.
 *
 * `NEXT_PUBLIC_LDC_URL` bascule vers un appel direct au service. C'est le repli
 * si l'hébergeur du front coupe les réponses longues : une réponse rédigée
 * s'étale sur 6 à 20 secondes de flux, et tous les proxys ne laissent pas
 * passer un flux SSE de cette durée. Le service doit alors déclarer l'origine
 * du front dans LDC_ORIGINES.
 *
 * Comme les rewrites, cette valeur est figée au build : la changer impose une
 * reconstruction du front.
 */
export function normaliserBase(url: string | undefined): string {
  const propre = (url ?? "").trim().replace(/\/+$/, "");
  if (!propre) return "/api/ldc";
  // Les deux écritures sont acceptées : « https://hote » comme
  // « https://hote/api/ldc ». Se tromper produisait un 404 sans indice.
  return propre.endsWith("/api/ldc") ? propre : `${propre}/api/ldc`;
}

export const BASE_LDC = normaliserBase(process.env.NEXT_PUBLIC_LDC_URL);

const TYPES_CONNUS = new Set([
  "analyse", "outil", "sources", "illustrations", "delta", "fin", "erreur",
]);

// ── Tampon SSE ───────────────────────────────────────────────────────────────

/**
 * Reconstitue des événements complets à partir de fragments de flux.
 *
 * Un événement SSE se termine par une ligne vide ; tout ce qui suit le dernier
 * séparateur est conservé pour le fragment suivant. Un `data:` illisible est
 * ignoré plutôt que de faire échouer la conversation entière : perdre un
 * fragment vaut mieux que perdre la réponse.
 */
export class TamponSSE {
  private reste = "";

  pousser(fragment: string): EvenementLdc[] {
    this.reste += fragment;
    const evenements: EvenementLdc[] = [];
    // \r\n\r\n : certains intermédiaires normalisent les fins de ligne.
    const blocs = this.reste.split(/\r?\n\r?\n/);
    this.reste = blocs.pop() ?? "";

    for (const bloc of blocs) {
      let nom = "";
      const donnees: string[] = [];
      for (const ligne of bloc.split(/\r?\n/)) {
        if (ligne.startsWith("event:")) nom = ligne.slice(6).trim();
        else if (ligne.startsWith("data:")) donnees.push(ligne.slice(5).trim());
      }
      if (!donnees.length || !TYPES_CONNUS.has(nom)) continue;
      try {
        evenements.push({ type: nom, ...JSON.parse(donnees.join("\n")) } as EvenementLdc);
      } catch {
        // fragment tronqué ou corrompu : on l'abandonne sans casser le flux
      }
    }
    return evenements;
  }
}

// ── Citations ────────────────────────────────────────────────────────────────

/**
 * Transforme les marqueurs [S1], [S2, S7] en liens markdown vers les sources.
 *
 * Le modèle groupe volontiers ses renvois ; les éclater en liens distincts est
 * ce qui permet de les rendre cliquables un par un, sans plugin markdown ni
 * parcours de l'arbre rendu — react-markdown fait le reste via `components.a`.
 *
 * Le remplacement est appliqué au texte en cours de streaming : un marqueur
 * encore incomplet (« [S1, » en fin de fragment) n'est pas reconnu, et le sera
 * au fragment suivant.
 */
export function baliserCitations(texte: string): string {
  return texte.replace(/\[\s*S\s*\d+(?:\s*[,;]\s*S?\s*\d+)*\s*\]/gi, (bloc) => {
    const numeros = bloc.match(/\d+/g);
    if (!numeros) return bloc;
    return numeros.map((n) => `[S${n}](#source-${n})`).join("");
  });
}

/** Numéro de source d'un lien produit par `baliserCitations`, sinon null. */
export function numeroDeCitation(href: string | undefined): number | null {
  const trouve = /^#source-(\d+)$/.exec(href ?? "");
  return trouve ? Number(trouve[1]) : null;
}

// ── Appels ───────────────────────────────────────────────────────────────────

function entetes(): Record<string, string> {
  const en: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const jeton = localStorage.getItem("token");
    if (jeton) en.Authorization = `Bearer ${jeton}`;
  }
  return en;
}

export interface DemandeLdc {
  question: string;
  /** Tours précédents, pour qu'une relance courte reste interprétable. */
  historique?: string[];
  signal?: AbortSignal;
}

/**
 * Pose une question et livre les événements au fur et à mesure.
 *
 * `fetch` plutôt qu'`EventSource` : la question part en POST (elle peut être
 * longue et porter un historique), ce qu'`EventSource` ne sait pas faire.
 */
export async function demanderReponse(
  demande: DemandeLdc,
  surEvenement: (evenement: EvenementLdc) => void,
): Promise<void> {
  const reponse = await fetch(`${BASE_LDC}/ask`, {
    method: "POST",
    headers: entetes(),
    body: JSON.stringify({
      question: demande.question,
      historique: demande.historique ?? [],
    }),
    signal: demande.signal,
  });

  if (!reponse.ok || !reponse.body) {
    const detail = await reponse.text().catch(() => "");
    let message = `Le service a répondu ${reponse.status}.`;
    // Un 404 ne vient jamais du contenu de la question : soit la route existe,
    // soit l'adresse du service est fausse. Le dire évite de chercher du côté
    // du corpus une panne qui est dans la configuration du déploiement.
    if (reponse.status === 404) {
      message =
        `Route introuvable (404) sur « ${BASE_LDC} » : l'assistant n'est pas ` +
        `joignable à cette adresse. Vérifier LDC_URL côté front, et que le ` +
        `déploiement a été reconstruit depuis.`;
    } else if (reponse.status === 401) {
      message = "Session expirée. Reconnectez-vous pour interroger l'assistant.";
    } else {
      try {
        message = JSON.parse(detail).detail || message;
      } catch {
        /* réponse non JSON : on garde le message générique */
      }
    }
    surEvenement({ type: "erreur", code: String(reponse.status), message });
    return;
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  const tampon = new TamponSSE();

  while (true) {
    const { done, value } = await lecteur.read();
    if (done) break;
    for (const evenement of tampon.pousser(decodeur.decode(value, { stream: true }))) {
      surEvenement(evenement);
    }
  }
}

export async function lireFiche(idoc: number, signal?: AbortSignal): Promise<FicheLdc> {
  const r = await fetch(`${BASE_LDC}/fiche/${idoc}`, { headers: entetes(), signal });
  if (!r.ok) throw new Error(`fiche ${idoc} : ${r.status}`);
  return r.json();
}

export async function lireSuggestions(signal?: AbortSignal): Promise<string[]> {
  const r = await fetch(`${BASE_LDC}/suggestions`, { headers: entetes(), signal });
  if (!r.ok) return [];
  return (await r.json()).questions ?? [];
}

export async function lireSante(signal?: AbortSignal): Promise<SanteLdc | null> {
  try {
    const r = await fetch(`${BASE_LDC}/sante`, { headers: entetes(), signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function envoyerRetour(retour: {
  question: string;
  reponse: string;
  utile: boolean;
  motifs?: string[];
  commentaire?: string;
  sources?: number[];
}): Promise<void> {
  await fetch(`${BASE_LDC}/feedback`, {
    method: "POST",
    headers: entetes(),
    body: JSON.stringify(retour),
  }).catch(() => undefined);
}

/**
 * Historique transmis à l'analyse : uniquement le dernier tour.
 *
 * Le backend n'en garde que deux entrées (`gemini_analyse`), et au-delà le
 * contexte dérive plus qu'il n'aide (spec 07 §8). La réponse est tronquée :
 * elle sert à lever une ambiguïté, pas à être re-résumée.
 */
export function historiquePour(
  tours: { question: string; reponse: string }[],
): string[] {
  const dernier = tours[tours.length - 1];
  if (!dernier) return [];
  return [
    `Question : ${dernier.question}`,
    `Réponse : ${dernier.reponse.slice(0, 500)}`,
  ];
}
