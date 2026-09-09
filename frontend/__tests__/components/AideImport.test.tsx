/**
 * L'aide à l'import doit décrire ce que le moteur accepte réellement.
 *
 * Demande d'un testeur producteur : « faut-il des en-têtes ? dans quel ordre
 * mettre les colonnes ? quel délimiteur ? ». Une aide fausse coûterait plus
 * cher qu'une aide absente : ces tests fixent les affirmations vérifiables.
 */

import { render, screen, fireEvent } from '@testing-library/react';

import AideImport from '@/components/AideImport';
import fr from '@/messages/fr.json';

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (cle: string) => {
      const chemin = cle.split('.');
      let valeur: unknown = jest.requireActual('@/messages/fr.json');
      for (const partie of chemin) valeur = (valeur as Record<string, unknown>)?.[partie];
      return (valeur as string) ?? cle;
    },
    locale: 'fr',
  }),
}));

describe("aide à l'import", () => {
  test('le détail est replié par défaut', () => {
    render(<AideImport />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  test("le panneau s'ouvre et se referme", () => {
    render(<AideImport />);
    const bouton = screen.getByRole('button');
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
  });

  test('les trois questions du testeur trouvent leur réponse', () => {
    render(<AideImport />);
    fireEvent.click(screen.getByRole('button'));
    const texte = document.body.textContent ?? '';

    // Faut-il des en-têtes ?
    expect(texte).toMatch(/en-tête/i);
    // Dans quel ordre mettre les colonnes ?
    expect(texte).toMatch(/ordre des colonnes est libre/i);
    // Quel délimiteur ?
    expect(texte).toMatch(/[Pp]oint-virgule, virgule ou tabulation/);
  });

  test('les formats de fichier annoncés sont ceux que le moteur accepte', () => {
    render(<AideImport />);
    fireEvent.click(screen.getByRole('button'));
    const texte = document.body.textContent ?? '';
    for (const extension of ['.csv', '.txt', '.tsv', '.xlsx', '.xls']) {
      expect(texte).toContain(extension);
    }
  });

  test("la déduction d'une colonne non nommée est annoncée", () => {
    // Le moteur interprète « Valeur » ou « Voie 1 » comme la température et
    // le signale : l'aide doit le dire, sans quoi la déduction surprend.
    render(<AideImport />);
    fireEvent.click(screen.getByRole('button'));
    const texte = document.body.textContent ?? '';
    expect(texte).toMatch(/Valeur/);
    expect(texte).toMatch(/interprétée/i);
  });

  test("l'exception d'unité sur horodatage est mentionnée", () => {
    // C'est le piège qui divisait la VP par 60 : l'unité déclarée ne
    // s'applique pas à une colonne horodatée.
    render(<AideImport />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.body.textContent ?? '').toMatch(/unité que vous avez choisie ne s'applique pas/i);
  });

  test('toutes les clés de traduction existent en français', () => {
    render(<AideImport />);
    fireEvent.click(screen.getByRole('button'));
    // Une clé manquante s'afficherait telle quelle : « controle.importHelp… »
    expect(document.body.textContent ?? '').not.toMatch(/controle\.importHelp/);
  });
});

describe('parité des traductions', () => {
  test('chaque clé de l\'aide existe aussi en anglais', () => {
    const en = jest.requireActual('@/messages/en.json');
    const clesAide = Object.keys(fr.controle).filter((k) => k.startsWith('importHelp'));
    expect(clesAide.length).toBeGreaterThan(0);
    for (const cle of clesAide) {
      expect(en.controle).toHaveProperty(cle);
    }
  });
});
