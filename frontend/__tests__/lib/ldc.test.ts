/**
 * Le flux SSE et les citations sont les deux endroits où une erreur silencieuse
 * coûte cher : un événement perdu fige la réponse à l'écran, une citation mal
 * balisée renvoie l'utilisateur vers la mauvaise fiche — et rien ne le signale.
 */

import {
  TamponSSE,
  baliserCitations,
  numeroDeCitation,
  historiquePour,
  normaliserBase,
} from "@/lib/ldc";

const evenement = (nom: string, charge: object) =>
  `event: ${nom}\ndata: ${JSON.stringify(charge)}\n\n`;

describe("TamponSSE", () => {
  it("lit plusieurs événements d'un même fragment", () => {
    const tampon = new TamponSSE();
    const recus = tampon.pousser(
      evenement("delta", { texte: "bon" }) + evenement("delta", { texte: "jour" }),
    );
    expect(recus).toEqual([
      { type: "delta", texte: "bon" },
      { type: "delta", texte: "jour" },
    ]);
  });

  it("recolle un événement coupé au milieu par le réseau", () => {
    const tampon = new TamponSSE();
    const brut = evenement("delta", { texte: "clarification" });
    const coupe = Math.floor(brut.length / 2);

    expect(tampon.pousser(brut.slice(0, coupe))).toEqual([]);
    expect(tampon.pousser(brut.slice(coupe))).toEqual([
      { type: "delta", texte: "clarification" },
    ]);
  });

  it("ne rend un événement qu'une fois la ligne vide reçue", () => {
    const tampon = new TamponSSE();
    expect(tampon.pousser('event: delta\ndata: {"texte":"a"}\n')).toEqual([]);
    expect(tampon.pousser("\n")).toEqual([{ type: "delta", texte: "a" }]);
  });

  it("accepte les fins de ligne normalisées par un intermédiaire", () => {
    const tampon = new TamponSSE();
    expect(tampon.pousser('event: delta\r\ndata: {"texte":"a"}\r\n\r\n')).toEqual([
      { type: "delta", texte: "a" },
    ]);
  });

  it("ignore un fragment illisible sans perdre les suivants", () => {
    const tampon = new TamponSSE();
    const recus = tampon.pousser(
      "event: delta\ndata: {ceci n'est pas du json\n\n" +
        evenement("delta", { texte: "suite" }),
    );
    expect(recus).toEqual([{ type: "delta", texte: "suite" }]);
  });

  it("ignore un type d'événement inconnu plutôt que de le propager", () => {
    const tampon = new TamponSSE();
    expect(tampon.pousser(evenement("ping", { t: 1 }))).toEqual([]);
  });

  it("conserve les événements structurés du contrat", () => {
    const tampon = new TamponSSE();
    const recus = tampon.pousser(
      evenement("sources", {
        passages: [{ index: 1, fiche_idoc: 1046, titre_fiche: "La clarification haute" }],
      }),
    );
    expect(recus[0]).toMatchObject({ type: "sources" });
    expect((recus[0] as any).passages[0].fiche_idoc).toBe(1046);
  });
});

describe("baliserCitations", () => {
  it("transforme un marqueur simple en lien de source", () => {
    expect(baliserCitations("Le gel remonte [S1].")).toBe(
      "Le gel remonte [S1](#source-1).",
    );
  });

  it("éclate un groupe de sources en autant de liens", () => {
    // Le modèle groupe volontiers : « [S1, S2, S3] ». Les garder groupés
    // rendrait la citation cliquable vers une seule fiche sur trois.
    expect(baliserCitations("étapes [S1, S2, S3]")).toBe(
      "étapes [S1](#source-1)[S2](#source-2)[S3](#source-3)",
    );
  });

  it("accepte les variantes d'écriture du modèle", () => {
    expect(baliserCitations("a [S2,S7] b [ S4 ] c [S1][S2]")).toBe(
      "a [S2](#source-2)[S7](#source-7) b [S4](#source-4) c [S1](#source-1)[S2](#source-2)",
    );
  });

  it("laisse intact un marqueur encore incomplet en cours de streaming", () => {
    expect(baliserCitations("le moût est clarifié [S1")).toBe(
      "le moût est clarifié [S1",
    );
  });

  it("ne touche pas aux crochets qui ne sont pas des citations", () => {
    expect(baliserCitations("voir [le schéma](http://x) et [note]")).toBe(
      "voir [le schéma](http://x) et [note]",
    );
  });
});

describe("numeroDeCitation", () => {
  it("reconnaît un lien de citation", () => {
    expect(numeroDeCitation("#source-12")).toBe(12);
  });

  it("écarte les autres liens", () => {
    expect(numeroDeCitation("https://ascocid.fr/ldc/view.php?id_document=1")).toBeNull();
    expect(numeroDeCitation(undefined)).toBeNull();
  });
});

describe("historiquePour", () => {
  it("ne transmet que le dernier tour", () => {
    const historique = historiquePour([
      { question: "q1", reponse: "r1" },
      { question: "q2", reponse: "r2" },
    ]);
    expect(historique).toEqual(["Question : q2", "Réponse : r2"]);
  });

  it("tronque une réponse longue : elle lève une ambiguïté, elle ne résume pas", () => {
    const historique = historiquePour([{ question: "q", reponse: "x".repeat(2000) }]);
    expect(historique[1].length).toBe("Réponse : ".length + 500);
  });

  it("part d'un historique vide au premier tour", () => {
    expect(historiquePour([])).toEqual([]);
  });
});

describe("normaliserBase", () => {
  it("retombe sur le proxy du front quand rien n'est configuré", () => {
    expect(normaliserBase(undefined)).toBe("/api/ldc");
    expect(normaliserBase("")).toBe("/api/ldc");
  });

  it("complète une URL de service donnée sans son chemin", () => {
    expect(normaliserBase("https://ldc.up.railway.app")).toBe(
      "https://ldc.up.railway.app/api/ldc",
    );
  });

  it("ne double pas le chemin quand il est déjà là", () => {
    // La confusion entre les deux écritures produisait un 404 opaque :
    // .../api/ldc/api/ldc/ask.
    expect(normaliserBase("https://ldc.up.railway.app/api/ldc")).toBe(
      "https://ldc.up.railway.app/api/ldc",
    );
  });

  it("tolère une barre oblique finale", () => {
    expect(normaliserBase("https://ldc.up.railway.app/")).toBe(
      "https://ldc.up.railway.app/api/ldc",
    );
    expect(normaliserBase("https://ldc.up.railway.app/api/ldc/")).toBe(
      "https://ldc.up.railway.app/api/ldc",
    );
  });
});
