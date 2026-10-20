/**
 * Relecture des illustrations transcrites par OCR.
 *
 * Ce qui est fixé : les fiches que l'assistant n'utilise pas encore (lecture
 * trop incertaine) sont signalées et listées en premier ; un relecteur voit les
 * mots à vérifier et peut les lever ; valider envoie une fiche sans plus aucun
 * doute ; et la correction saisie est bien celle qui part au service.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import PanneauRelecture from '@/components/PanneauRelecture';
import * as ldc from '@/lib/ldc';

jest.mock('@/lib/ldc', () => ({
  listerTranscriptions: jest.fn(),
  lireTranscription: jest.fn(),
  corrigerTranscription: jest.fn(),
}));

const mocks = ldc as jest.Mocked<typeof ldc>;

const resume = (champs: Partial<ldc.ResumeTranscription>): ldc.ResumeTranscription => ({
  code: 'FDC_ARMAGNAC', idoc: 1416, titre: 'Armagnac', statut: 'a_verifier', douteux: 1,
  verifie_par: '', verifie_le: '', famille: 'FDC', qualite: 92, indexee: true, ...champs,
});

const transcription: ldc.Transcription = {
  idoc: 1416, code: 'FDC_ARMAGNAC', titre: 'Armagnac', image: '/api/ldc/illustration/1416',
  image_sha256: 'sha', source: 'ocr-tesseract 5.3.4', qualite_ocr: 92, statut: 'a_verifier',
  verifie_par: '', verifie_le: '', texte_ocr: 'Densité du jus : 1 O65,5.',
  rubriques: [{
    titre: 'QUALITES TECHNOLOGIQUES DU FRUIT', note: '',
    lignes: [{ intitule: 'Densité du jus', valeur: '1 O65,5.', douteux: ['O65,5.'] }],
  }],
};

beforeEach(() => {
  jest.resetAllMocks();
  mocks.listerTranscriptions.mockResolvedValue({
    erreurs: [],
    transcriptions: [
      resume({}),
      resume({ code: 'FDC_TABLEAU', titre: 'Tableau des pollinisations', qualite: 38, indexee: false, douteux: 0 }),
    ],
  });
  mocks.lireTranscription.mockResolvedValue(transcription);
  mocks.corrigerTranscription.mockImplementation(async (_code, c) => ({ ...transcription, ...c }));
});

test("les fiches absentes de l'assistant sont signalées et listées en premier", async () => {
  render(<PanneauRelecture />);
  const titres = await screen.findAllByText(/Armagnac|Tableau des pollinisations/);
  expect(titres[0]).toHaveTextContent('Tableau des pollinisations');
  expect(screen.getByText(/absente de l'assistant/)).toBeInTheDocument();
});

test("l'image d'origine est affichée à côté du texte, avec les mots à vérifier", async () => {
  render(<PanneauRelecture />);
  fireEvent.click(await screen.findByText('Armagnac'));
  expect(await screen.findByAltText(/Image d'origine : Armagnac/)).toHaveAttribute('src', '/api/ldc/illustration/1416');
  expect(screen.getByText('O65,5.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Vérifié' }));
  expect(screen.queryByText(/À vérifier sur l'image/)).not.toBeInTheDocument();
});

test("la correction saisie part au service, et valider lève tous les doutes", async () => {
  render(<PanneauRelecture />);
  fireEvent.click(await screen.findByText('Armagnac'));
  fireEvent.change(await screen.findByDisplayValue('1 O65,5.'), { target: { value: '1 065,5.' } });
  fireEvent.click(screen.getByRole('button', { name: /Valider : conforme/ }));

  await waitFor(() => expect(mocks.corrigerTranscription).toHaveBeenCalled());
  const [code, envoi] = mocks.corrigerTranscription.mock.calls[0];
  expect(code).toBe('FDC_ARMAGNAC');
  expect(envoi.statut).toBe('valide');
  expect(envoi.rubriques[0].lignes[0]).toEqual({ intitule: 'Densité du jus', valeur: '1 065,5.', douteux: [] });
  expect(await screen.findByText(/l'assistant est à jour/)).toBeInTheDocument();
});

test("enregistrer comme corrigée garde les doutes non levés", async () => {
  render(<PanneauRelecture />);
  fireEvent.click(await screen.findByText('Armagnac'));
  fireEvent.click(await screen.findByRole('button', { name: /Enregistrer \(corrigée\)/ }));
  await waitFor(() => expect(mocks.corrigerTranscription).toHaveBeenCalled());
  expect(mocks.corrigerTranscription.mock.calls[0][1].rubriques[0].lignes[0].douteux).toEqual(['O65,5.']);
});
