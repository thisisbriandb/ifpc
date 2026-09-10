/**
 * La bulle d'assistant est présente sur toute l'application : ses règles
 * d'effacement sont donc la seule chose qui l'empêche de recouvrir l'interface
 * existante. Trois écrans ont déjà un élément fixe en bas à droite.
 */

import { render, screen } from "@testing-library/react";
import AssistantLauncher from "@/components/assistant/AssistantLauncher";

let cheminCourant = "/";
jest.mock("next/navigation", () => ({
  usePathname: () => cheminCourant,
}));

// Le panneau embarque le chat complet, qui interroge le service au montage ;
// seul le lanceur est en test ici.
jest.mock("@/components/assistant/AssistantChat", () => ({
  __esModule: true,
  default: () => <div data-testid="chat" />,
}));

const rendre = (chemin: string) => {
  cheminCourant = chemin;
  return render(<AssistantLauncher />);
};

const bulle = () =>
  screen.queryByRole("button", { name: /assistant du livre de connaissances/i });

describe("AssistantLauncher", () => {
  it("s'affiche sur un écran d'outil ordinaire", () => {
    rendre("/lots");
    expect(bulle()).toBeInTheDocument();
  });

  it("s'efface là où l'assistant occupe déjà la page", () => {
    rendre("/assistant");
    expect(bulle()).not.toBeInTheDocument();
  });

  it("s'efface sur la connexion, où il n'y a rien à demander", () => {
    rendre("/login");
    expect(bulle()).not.toBeInTheDocument();
  });

  it("s'efface sur le chai virtuel, dont le panneau occupe le même coin", () => {
    // app/cuves/chai/page.tsx : panneau `fixed bottom-6 right-6 z-40`.
    rendre("/cuves/chai");
    expect(bulle()).not.toBeInTheDocument();
  });

  it("reste présent sur les autres écrans de cuves", () => {
    rendre("/cuves");
    expect(bulle()).toBeInTheDocument();
  });

  it("remonte au-dessus du bouton flottant mobile de /controle", () => {
    // app/controle/page.tsx : `lg:hidden fixed bottom-6 right-6`.
    rendre("/controle");
    expect(bulle()?.className).toContain("bottom-24");
  });

  it("garde sa position basse là où rien ne l'encombre", () => {
    rendre("/historique");
    expect(bulle()?.className).toContain("bottom-6");
    expect(bulle()?.className).not.toContain("bottom-24");
  });
});
