import { uniteDuProcede, procedeAccorde } from '@/lib/pasteurisation';

describe('liaison procédé ↔ unité de temps', () => {
  test('un procédé impose son unité de relevé', () => {
    expect(uniteDuProcede('flash')).toBe('seconde');
    expect(uniteDuProcede('classique')).toBe('minute');
    expect(uniteDuProcede('tunnel')).toBe('minute');
  });

  test('un procédé inconnu retombe sur la minute', () => {
    expect(uniteDuProcede('')).toBe('minute');
    expect(uniteDuProcede('procédé-maison')).toBe('minute');
  });

  test("choisir une unité ramène un procédé incompatible", () => {
    // Le cas qui motivait le garde-fou : flash relevé en minutes
    expect(procedeAccorde('flash', 'minute')).toBe('classique');
    expect(procedeAccorde('classique', 'seconde')).toBe('flash');
    expect(procedeAccorde('tunnel', 'seconde')).toBe('flash');
  });

  test('un procédé déjà compatible est préservé', () => {
    // « tunnel » ne doit pas être écrasé par « classique » : les deux sont en minutes
    expect(procedeAccorde('tunnel', 'minute')).toBe('tunnel');
    expect(procedeAccorde('classique', 'minute')).toBe('classique');
    expect(procedeAccorde('flash', 'seconde')).toBe('flash');
  });

  test("aucune combinaison incohérente n'est atteignable", () => {
    for (const procede of ['flash', 'classique', 'tunnel']) {
      for (const unite of ['minute', 'seconde'] as const) {
        const accorde = procedeAccorde(procede, unite);
        expect(uniteDuProcede(accorde)).toBe(unite);
      }
    }
  });
});
