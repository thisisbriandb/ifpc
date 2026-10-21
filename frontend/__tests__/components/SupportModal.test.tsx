import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupportModal from '@/components/SupportModal';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const envoyer = api.envoyerDemandeSupport as jest.Mock;

const afficher = (onClose = jest.fn()) =>
  render(
    <I18nProvider>
      <SupportModal open={true} onClose={onClose} />
    </I18nProvider>
  );

const remplir = async () => {
  await userEvent.type(screen.getByPlaceholderText('En quelques mots'), 'Export impossible');
  await userEvent.type(
    screen.getByPlaceholderText("Que s'est-il passé ? Qu'attendiez-vous ?"),
    'Le bouton ne fait rien.'
  );
};

describe('SupportModal', () => {
  beforeEach(() => jest.clearAllMocks());

  test("ne s'affiche pas fermé", () => {
    const { container } = render(
      <I18nProvider>
        <SupportModal open={false} onClose={jest.fn()} />
      </I18nProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("n'envoie pas une demande sans titre ni description", () => {
    afficher();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  test('envoie la demande avec la page courante, puis donne son numéro', async () => {
    envoyer.mockResolvedValue({ numero: 42, url: 'https://github.com/x/y/issues/42' });
    afficher();

    await userEvent.click(screen.getByRole('button', { name: 'Question' }));
    await remplir();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(envoyer).toHaveBeenCalledWith(expect.objectContaining({
      categorie: 'QUESTION',
      titre: 'Export impossible',
      description: 'Le bouton ne fait rien.',
      page: '/',
    }));
    expect(await screen.findByText(/Demande n°42 enregistrée/)).toBeInTheDocument();
  });

  test('trop de demandes : le dit clairement', async () => {
    envoyer.mockRejectedValue({ response: { status: 429 } });
    afficher();

    await remplir();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('réessayez dans une heure');
  });

  test("help desk indisponible : renvoie vers l'adresse du service informatique", async () => {
    envoyer.mockRejectedValue({ response: { status: 502 } });
    afficher();

    await remplir();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('service-informatique@ifpc.eu')
    );
  });
});
