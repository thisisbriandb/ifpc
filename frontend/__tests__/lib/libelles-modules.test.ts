/**
 * Libellés des modules : ce que l'utilisateur lit dans la navigation.
 *
 * Le module de contrôle s'appelle « Efficacité du traitement thermique » et non
 * plus « Calcul de la valeur pasteurisatrice » : c'est ce que fait l'outil, dit
 * dans les termes du métier plutôt que dans ceux du calcul.
 *
 * La valeur pasteurisatrice reste, elle, la grandeur calculée et affichée —
 * renommer le titre ne renomme pas la mesure.
 */

import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

const LANGUES = { fr, en } as const;

describe('titre du module de contrôle', () => {
  test.each(Object.keys(LANGUES) as (keyof typeof LANGUES)[])(
    '%s — le titre parle d\'efficacité du traitement',
    (langue) => {
      const messages = LANGUES[langue];
      const attendu = langue === 'fr' ? /Efficacité du traitement thermique/i
                                      : /Heat treatment effectiveness/i;
      expect(messages.controle.title).toMatch(attendu);
      expect(messages.nav.calculVP).toMatch(attendu);
      expect(messages.home.moduleMeta.controle).toMatch(attendu);
    },
  );

  test.each(Object.keys(LANGUES) as (keyof typeof LANGUES)[])(
    '%s — le titre ne parle plus de calcul de VP',
    (langue) => {
      const messages = LANGUES[langue];
      for (const libelle of [messages.controle.title, messages.nav.calculVP,
                             messages.home.modules.calculVP, messages.home.moduleMeta.controle]) {
        expect(libelle).not.toMatch(/calcul/i);
        expect(libelle).not.toMatch(/valeur pasteurisatrice/i);
        expect(libelle).not.toMatch(/pasteurisation value/i);
      }
    },
  );
});

describe('la grandeur mesurée', () => {
  test('« valeur pasteurisatrice » reste le nom de la mesure', () => {
    // Le titre de l'outil change, pas ce qu'il calcule.
    expect(fr.resultDisplay.pasteurisationValue).toMatch(/Valeur Pasteurisatrice/i);
    expect(en.resultDisplay.pasteurisationValue).toMatch(/Pasteurisation Value/i);
  });

  test("l'unité UP est conservée", () => {
    expect(fr.bareme.up).toBe('UP');
  });
});
