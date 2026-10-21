/**
 * Sous la réponse, seules les sources qu'elle cite : les autres passages ont
 * été lus par le modèle sans lui servir, les présenter comme « sources »
 * laisserait croire que la réponse s'appuie sur eux.
 */

import { render, screen, fireEvent } from '@testing-library/react';

import SourceList from '@/components/assistant/SourceList';
import type { SourceLdc } from '@/lib/ldc';

const source = (index: number, titre: string): SourceLdc => ({
  index, fiche_idoc: 1000 + index, titre_fiche: titre, titre_section: '', terme: '',
  origine: 'fusion', provenance: 'ascocid', url: '',
});
const huit = Array.from({ length: 8 }, (_, i) => source(i + 1, `Fiche ${i + 1}`));

test('seules les sources citées sont listées, les autres restent consultables', () => {
  render(<SourceList sources={huit} cites={[5, 6]} surligne={null} onOuvrir={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /2 sources citées du Livre/ }));
  expect(screen.getByText('Fiche 5')).toBeInTheDocument();
  expect(screen.getByText('Fiche 6')).toBeInTheDocument();
  expect(screen.queryByText('Fiche 1')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Voir les 6 autres passages consultés/ }));
  expect(screen.getByText('Fiche 1')).toBeInTheDocument();
});

test("une réponse sans citation le dit, au lieu d'annoncer des sources", () => {
  render(<SourceList sources={huit} cites={[]} surligne={null} onOuvrir={() => undefined} />);
  expect(screen.getByRole('button', { name: /8 passages consultés, aucun cité/ })).toBeInTheDocument();
});

test('une citation inventée (numéro hors des passages) ne crée pas de source', () => {
  render(<SourceList sources={huit} cites={[3, 42]} surligne={null} onOuvrir={() => undefined} />);
  expect(screen.getByRole('button', { name: /1 source citée du Livre/ })).toBeInTheDocument();
});
