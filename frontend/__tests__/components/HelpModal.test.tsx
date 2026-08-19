import { render, screen, waitFor } from '@testing-library/react';
import HelpModal from '@/components/HelpModal';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

describe('HelpModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render when open is false', () => {
    const { container } = render(
      <I18nProvider>
        <HelpModal helpKey="test_key" defaultContent="Contenu de test" open={false} onClose={jest.fn()} />
      </I18nProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('fetches and renders help content when open is true', async () => {
    (api.getHelpText as jest.Mock).mockResolvedValue({ key: 'test_key', content: 'Explication dynamique' });

    render(
      <I18nProvider>
        <HelpModal helpKey="test_key" defaultContent="Contenu par défaut" open={true} onClose={jest.fn()} />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Explication dynamique')).toBeInTheDocument();
    });
  });

  test('falls back to defaultContent on API failure', async () => {
    (api.getHelpText as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <I18nProvider>
        <HelpModal helpKey="test_key" defaultContent="Contenu par défaut" open={true} onClose={jest.fn()} />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Contenu par défaut')).toBeInTheDocument();
    });
  });
});
