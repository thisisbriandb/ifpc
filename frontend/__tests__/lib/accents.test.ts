/**
 * La table des accents relie une page à son domaine. Une erreur ici ne casse
 * rien — elle donne simplement à un écran la couleur d'un autre, ce qui défait
 * exactement le lien que ce dispositif cherche à créer.
 */

import { accentDe } from "@/lib/accents";

describe("accentDe", () => {
  it("range les deux outils de pasteurisation dans la même section", () => {
    expect(accentDe("/controle").cle).toBe("pasteurisation");
    expect(accentDe("/bareme").cle).toBe("pasteurisation");
    expect(accentDe("/controle").couleur).toBe(accentDe("/bareme").couleur);
  });

  it("suit les sous-chemins d'une section", () => {
    expect(accentDe("/colorimetrie/assemblage").cle).toBe("colorimetrie");
    expect(accentDe("/cuves/chai").cle).toBe("cuves");
    expect(accentDe("/cuves/corbeille").cle).toBe("cuves");
  });

  it("rattache les lots aux cuves : c'est le même domaine de travail", () => {
    // /lots ne partage pas le préfixe de /cuves, mais bien son domaine —
    // la barre latérale les regroupe déjà sous « Gestion de cuves ».
    expect(accentDe("/lots").cle).toBe("cuves");
    expect(accentDe("/lots").couleur).toBe(accentDe("/cuves").couleur);
  });

  it("rend l'accent neutre pour les écrans sans domaine", () => {
    // Accueil, historique et profil n'appartiennent à aucune section : leur
    // entrée de menu garde la couleur neutre.
    expect(accentDe("/").cle).toBe("neutre");
    expect(accentDe("/historique").cle).toBe("neutre");
    expect(accentDe("/profil").cle).toBe("neutre");
  });

  it("tolère une barre finale et une chaîne de requête", () => {
    expect(accentDe("/cuves/").cle).toBe("cuves");
    expect(accentDe("/controle?lot=24-A").cle).toBe("pasteurisation");
  });

  it("ne confond pas un chemin qui commence par les mêmes lettres", () => {
    // « /lotsdivers » n'est pas « /lots » : sans la comparaison par segment,
    // n'importe quelle page future prendrait la couleur d'une autre.
    expect(accentDe("/lotsdivers").cle).toBe("neutre");
  });
});
