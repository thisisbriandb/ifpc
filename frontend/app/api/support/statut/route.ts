import { supportActif } from "@/lib/support-serveur";

// Lu à chaque appel : l'ajout du jeton sur Vercel doit se voir sans rebuild.
export const dynamic = "force-dynamic";

/** L'écran n'affiche le bouton que si une demande peut réellement partir. */
export function GET() {
  return Response.json({ actif: supportActif() });
}
