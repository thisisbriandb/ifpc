import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthModal from '@/components/AuthModal';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

describe('AuthModal Component', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login mode by default and handles input changes', () => {
    render(<AuthModal onClose={onClose} />);

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('votre@email.com')).toBeInTheDocument();
  });

  test('switches to registration mode when link is clicked', () => {
    render(<AuthModal onClose={onClose} />);

    const switchBtn = screen.getByRole('button', { name: "S'inscrire" });
    fireEvent.click(switchBtn);

    expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Prénom')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nom')).toBeInTheDocument();
  });

  test('submits login form and calls login API', async () => {
    (api.login as jest.Mock).mockResolvedValue({ token: 'jwt-123' });

    render(<AuthModal onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), { target: { value: 'user@ifpc.eu' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });

    const submitBtn = screen.getByRole('button', { name: 'Se connecter' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({ email: 'user@ifpc.eu', password: 'secret123' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  test('shows pending message if registration requires admin approval', async () => {
    (api.register as jest.Mock).mockResolvedValue({ pending: true, message: 'Attente administrateur.' });

    render(<AuthModal onClose={onClose} />);

    const switchBtn = screen.getByRole('button', { name: "S'inscrire" });
    fireEvent.click(switchBtn);

    fireEvent.change(screen.getByPlaceholderText('Prénom'), { target: { value: 'Jean' } });
    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Dupont' } });
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), { target: { value: 'jean@ifpc.eu' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });

    const submitBtn = screen.getByRole('button', { name: "S'inscrire" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Attente administrateur.')).toBeInTheDocument();
    });
  });
});
