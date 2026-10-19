/**
 * Panneau « Documents de l'assistant » de l'administration.
 *
 * Ce qui est fixé ici : l'administrateur lit la raison d'un refus (un scan,
 * un doublon) au lieu d'un échec muet, l'état de chaque document se lit en
 * toutes lettres, et un retrait — qui retire le document des réponses de tous
 * les utilisateurs — demande une confirmation.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import PanneauDocuments from '@/components/PanneauDocuments';
import * as ldc from '@/lib/ldc';

jest.mock('@/lib/ldc', () => ({
  BASE_LDC: '/api/ldc',
  listerDocuments: jest.fn(),
  envoyerDocument: jest.fn(),
  retirerDocument: jest.fn(),
}));

const mocks = ldc as jest.Mocked<typeof ldc>;

const doc = (champs: Partial<ldc.DocumentAdmin>): ldc.DocumentAdmin => ({
  idoc: 1000000, titre: 'Guide clarification', nom_fichier: 'guide.pdf', format: 'pdf',
  octets: 250_000, ajoute_le: '2026-10-19T10:00:00', ajoute_par: 'admin@ifpc.com',
  etat: 'pret', message: '', passages: 12, ...champs,
});

beforeEach(() => {
  jest.resetAllMocks();
  mocks.listerDocuments.mockResolvedValue({ documents: [], taille_max: 25 * 1024 * 1024 });
});

test("sans document, le panneau le dit", async () => {
  render(<PanneauDocuments />);
  expect(await screen.findByText(/Aucun document ajouté/)).toBeInTheDocument();
});

test("l'état de chaque document se lit en toutes lettres", async () => {
  mocks.listerDocuments.mockResolvedValue({
    taille_max: 1,
    documents: [
      doc({ idoc: 1, etat: 'pret', passages: 12 }),
      doc({ idoc: 2, titre: 'Note', etat: 'en_cours' }),
      doc({ idoc: 3, titre: 'Vieux', etat: 'erreur', message: 'Intégration impossible (OSError).' }),
    ],
  });
  render(<PanneauDocuments />);
  expect(await screen.findByText(/Disponible pour l'assistant · 12 passages/)).toBeInTheDocument();
  expect(screen.getByText(/En cours d'intégration/)).toBeInTheDocument();
  expect(screen.getByText(/Échec — Intégration impossible \(OSError\)/)).toBeInTheDocument();
  // Le titre mène au fichier d'origine.
  expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/api/ldc/document/1/fichier');
});

test("un refus du service est affiché avec sa raison", async () => {
  mocks.envoyerDocument.mockRejectedValue(
    new Error("Ce PDF ne contient pas de texte sélectionnable : c'est probablement un document scanné."));
  render(<PanneauDocuments />);
  await screen.findByText(/Aucun document ajouté/);

  const fichier = new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' });
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [fichier] } });
  fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }));

  expect(await screen.findByText(/document scanné/)).toBeInTheDocument();
  expect(mocks.envoyerDocument).toHaveBeenCalledWith(fichier, '');
});

test("un document accepté apparaît dans la liste", async () => {
  mocks.envoyerDocument.mockResolvedValue(doc({ etat: 'en_cours' }));
  render(<PanneauDocuments />);
  await screen.findByText(/Aucun document ajouté/);

  mocks.listerDocuments.mockResolvedValue({ taille_max: 1e9, documents: [doc({})] });
  const fichier = new File(['x'], 'guide.pdf', { type: 'application/pdf' });
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [fichier] } });
  fireEvent.change(screen.getByPlaceholderText(/Ex\./), { target: { value: 'Mon guide' } });
  fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }));

  expect(await screen.findByText('Guide clarification')).toBeInTheDocument();
  expect(mocks.envoyerDocument).toHaveBeenCalledWith(fichier, 'Mon guide');
});

test("le retrait demande une confirmation", async () => {
  mocks.listerDocuments.mockResolvedValue({ taille_max: 1, documents: [doc({})] });
  mocks.retirerDocument.mockResolvedValue();
  render(<PanneauDocuments />);
  await screen.findByText('Guide clarification');

  fireEvent.click(screen.getByTitle(/Retirer ce document/));
  expect(mocks.retirerDocument).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retirer' }));

  await waitFor(() => expect(mocks.retirerDocument).toHaveBeenCalledWith(1000000));
  await waitFor(() => expect(screen.queryByText('Guide clarification')).not.toBeInTheDocument());
});
