import { uniteDuProcede, procedeAccorde, formatHoldTime } from '@/lib/pasteurisation';

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

describe('affichage du temps de maintien', () => {
  test("l'unité vient de la valeur, pas du procédé", () => {
    expect(formatHoldTime(120)).toEqual({ value: '120', unit: 'min' });
    expect(formatHoldTime(2.5)).toEqual({ value: '2.5', unit: 'min' });
    expect(formatHoldTime(1)).toEqual({ value: '1.0', unit: 'min' });
    // Sous la minute on bascule en secondes plutôt que d'écrire « 0.9 min »
    expect(formatHoldTime(0.928)).toEqual({ value: '56', unit: 'sec' });
    expect(formatHoldTime(0.0522)).toEqual({ value: '3.1', unit: 'sec' });
  });

  test('un temps très court ne devient jamais zéro', () => {
    // Cidre doux à 72 °C puis 80 °C : 0,99 s et 0,0099 s
    expect(formatHoldTime(0.0165)).toEqual({ value: '< 1', unit: 'sec' });
    expect(formatHoldTime(0.000165)).toEqual({ value: '< 1', unit: 'sec' });
  });

  test('aucun barème cidre ne s\'affiche « 0.0 »', () => {
    // Sacch. cerevisiae 1 (Tref 60 °C, z 4) et 2, sur toute la plage utile
    for (const [tRef, z, vp] of [[60, 4, 16.5], [60, 4, 6.0]]) {
      for (const tC of [60, 63, 65, 68, 70, 72, 75, 78, 80, 85, 90, 95]) {
        const holdMin = vp / Math.pow(10, (tC - tRef) / z);
        const { value } = formatHoldTime(holdMin);
        expect(value).not.toBe('0.0');
        expect(parseFloat(value)).not.toBe(0);
      }
    }
  });

  test('une valeur non exploitable ne prétend pas être un temps', () => {
    expect(formatHoldTime(0)).toEqual({ value: '—', unit: 'min' });
    expect(formatHoldTime(Number.POSITIVE_INFINITY)).toEqual({ value: '—', unit: 'min' });
    expect(formatHoldTime(Number.NaN)).toEqual({ value: '—', unit: 'min' });
  });
});
