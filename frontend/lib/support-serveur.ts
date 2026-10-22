/**
 * Help desk, côté serveur Next (fonctions Vercel).
 *
 * Il vivait d'abord dans le Core API. Il a été déplacé ici le 22/10/2026 : une
 * panne de Railway bloquait tout déploiement du Core API, et le help desk n'a
 * besoin de lui que pour une chose — savoir qui est connecté, ce que
 * /api/auth/me dit depuis toujours. Il est ainsi livré par Vercel seul.
 *
 * Le dépôt de destination est public par défaut : l'issue ne porte jamais
 * l'identité du demandeur, seulement une référence aléatoire. L'identité part
 * par e-mail au service informatique, avec la même référence.
 *
 * Ne jamais importer ce fichier depuis un composant : il lit des secrets.
 */

export type CategorieSupport = "BUG" | "QUESTION" | "IDEE";

const CATEGORIES: Record<CategorieSupport, { etiquette: string; libelle: string }> = {
  BUG: { etiquette: "bug", libelle: "Problème" },
  QUESTION: { etiquette: "question", libelle: "Question" },
  IDEE: { etiquette: "enhancement", libelle: "Suggestion" },
};

export const TITRE_MAX = 120;
export const DESCRIPTION_MAX = 5000;
export const DEMANDES_PAR_HEURE = 5;
const ETIQUETTE_HELP_DESK = "help-desk";

export interface Demande {
  categorie: CategorieSupport;
  titre: string;
  description: string;
  page?: string;
  version?: string;
}

interface Demandeur {
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
}

interface Config {
  jeton?: string;
  depot: string;
  springUrl: string;
  resendCle?: string;
  resendDe: string;
  resendA: string;
}

function config(): Config {
  return {
    jeton: process.env.SUPPORT_GITHUB_TOKEN?.trim() || undefined,
    depot: process.env.SUPPORT_GITHUB_REPO?.trim() || "IFPC-APPS/PADOC",
    springUrl: (process.env.SPRING_URL || "http://localhost:8080").replace(/\/+$/, ""),
    resendCle: process.env.RESEND_API_KEY?.trim() || undefined,
    resendDe: process.env.RESEND_FROM_EMAIL || "service-informatique@ifpc.eu",
    resendA: process.env.RESEND_ADMIN_EMAIL || "service-informatique@ifpc.eu",
  };
}

export function supportActif(): boolean {
  const c = config();
  return Boolean(c.jeton) && c.depot.includes("/");
}

/** « @quelqu'un » dans une issue notifie ce compte : la mention ne part pas. */
export function neutraliser(texte: string): string {
  return texte.replace(/@(?=[A-Za-z0-9-])/g, "@​");
}

function refus(status: number, message: string): Response {
  return Response.json({ status, message }, { status });
}

export function valider(d: Partial<Demande> | null): string | null {
  if (!d || !d.categorie || !(d.categorie in CATEGORIES)) return "Choisissez le type de demande.";
  if (typeof d.titre !== "string" || !d.titre.trim()) return "Le titre est obligatoire.";
  if (d.titre.trim().length > TITRE_MAX) return `Le titre ne doit pas dépasser ${TITRE_MAX} caractères.`;
  if (typeof d.description !== "string" || !d.description.trim()) return "Décrivez votre demande.";
  if (d.description.length > DESCRIPTION_MAX)
    return `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`;
  return null;
}

export function corpsIssue(d: Demande, reference: string): string {
  const lignes = [`**Type :** ${CATEGORIES[d.categorie].libelle}`];
  if (d.page?.trim()) lignes.push(`**Page :** \`${d.page.trim().replace(/`/g, "")}\``);
  if (d.version?.trim()) lignes.push(`**Version :** ${neutraliser(d.version.trim())}`);
  return [
    lignes.join("\n"),
    "",
    "---",
    "",
    neutraliser(d.description.trim()),
    "",
    "---",
    `_Demande envoyée depuis le help desk de PADOC. Référence : \`${reference}\` — l'identité du demandeur est transmise au service informatique, pas ici._`,
    "",
  ].join("\n");
}

// Anti-rafale par compte. En mémoire d'une instance de fonction : une
// instance neuve repart de zéro. C'est un frein, pas une garantie — il suffit
// contre un double-clic ou une boucle, ce qu'on lui demande.
const envoisRecents = new Map<string, number[]>();

export function reserverEnvoi(compte: string, maintenant = Date.now()): boolean {
  const cle = compte.toLowerCase();
  const recents = (envoisRecents.get(cle) ?? []).filter((t) => t > maintenant - 3_600_000);
  if (recents.length >= DEMANDES_PAR_HEURE) {
    envoisRecents.set(cle, recents);
    return false;
  }
  recents.push(maintenant);
  envoisRecents.set(cle, recents);
  return true;
}

export function oublierEnvois() {
  envoisRecents.clear();
}

/** Qui est connecté : le Core API le dit, à partir du même jeton. */
async function demandeur(authorization: string | null, c: Config): Promise<Demandeur | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(`${c.springUrl}/api/auth/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.email ? u : null;
  } catch {
    return null;
  }
}

async function creerIssue(issue: Record<string, unknown>, c: Config): Promise<globalThis.Response> {
  return fetch(`https://api.github.com/repos/${c.depot}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.jeton}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(issue),
    cache: "no-store",
  });
}

const echapper = (s: string | undefined) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Seul ce message relie la demande à la personne, pour pouvoir lui répondre. */
async function prevenirServiceInformatique(
  u: Demandeur, numero: number, url: string, titre: string, reference: string, c: Config
) {
  if (!c.resendCle) {
    console.warn(`Help desk #${numero} : RESEND_API_KEY absente, le service informatique n'est pas prévenu.`);
    return;
  }
  const html = `<p>Une demande a été envoyée depuis la plateforme : <strong>${echapper(titre)}</strong></p>
<table cellpadding="6">
<tr><td><b>Demandeur</b></td><td>${echapper(u.firstName)} ${echapper(u.lastName)}</td></tr>
<tr><td><b>Email</b></td><td><a href="mailto:${echapper(u.email)}">${echapper(u.email)}</a></td></tr>
<tr><td><b>Entreprise</b></td><td>${echapper(u.companyName)}</td></tr>
<tr><td><b>Référence</b></td><td>${echapper(reference)}</td></tr>
</table>
<p><a href="${echapper(url)}">Voir la demande sur GitHub</a></p>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.resendCle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `IFPC Service Informatique <${c.resendDe}>`,
        to: [c.resendA],
        subject: `[IFPC] Help desk #${numero} : ${titre}`,
        html,
      }),
    });
    if (!r.ok) console.error(`Help desk #${numero} : e-mail refusé par Resend [${r.status}]`);
  } catch (e) {
    // L'issue existe : on ne fait pas échouer la demande pour un e-mail.
    console.error(`Help desk #${numero} : e-mail non envoyé`, e);
  }
}

export async function traiterDemande(requete: Request): Promise<Response> {
  const c = config();
  if (!supportActif()) return refus(503, "Le help desk n'est pas configuré.");

  const u = await demandeur(requete.headers.get("authorization"), c);
  if (!u) return refus(401, "Authentification requise");

  let d: Partial<Demande> | null;
  try {
    d = await requete.json();
  } catch {
    d = null;
  }
  const erreur = valider(d);
  if (erreur) return refus(400, erreur);
  const demande = d as Demande;

  if (!reserverEnvoi(u.email)) return refus(429, "Trop de demandes envoyées : réessayez dans une heure.");

  const reference = crypto.randomUUID().slice(0, 8);
  const titre = demande.titre.trim();
  const issue: Record<string, unknown> = {
    title: `[${CATEGORIES[demande.categorie].libelle}] ${neutraliser(titre)}`,
    body: corpsIssue(demande, reference),
    labels: [ETIQUETTE_HELP_DESK, CATEGORIES[demande.categorie].etiquette],
  };

  try {
    let r = await creerIssue(issue, c);
    // Étiquettes refusées : la demande compte plus que son classement.
    if (r.status === 422) {
      console.warn("Help desk : étiquettes refusées par GitHub, nouvel essai sans étiquette.");
      delete issue.labels;
      r = await creerIssue(issue, c);
    }
    if (r.status !== 201) {
      console.error(`Help desk : GitHub a refusé l'issue [${r.status}] : ${await r.text()}`);
      return refus(502, "La demande n'a pas pu être transmise.");
    }
    const cree = await r.json();
    await prevenirServiceInformatique(u, cree.number, cree.html_url, titre, reference, c);
    return Response.json({ numero: cree.number, url: cree.html_url }, { status: 201 });
  } catch (e) {
    console.error("Help desk : GitHub injoignable", e);
    return refus(502, "La demande n'a pas pu être transmise.");
  }
}
