import { traiterDemande } from "@/lib/support-serveur";

export const dynamic = "force-dynamic";

export function POST(requete: Request) {
  return traiterDemande(requete);
}
