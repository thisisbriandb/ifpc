import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AdminPanel from '@/components/AdminPanel';
import { useAuthStore } from '@/lib/store';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

describe('AdminPanel Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { firstName: 'Super', lastName: 'Admin', email: 'admin@ifpc.eu', role: 'ADMIN' },
      isLoading: false,
    });
    jest.clearAllMocks();
  });

  test('does not render if user is not ADMIN', () => {
    useAuthStore.setState({
      user: { firstName: 'Simple', lastName: 'User', email: 'user@ifpc.eu', role: 'USER' },
      isLoading: false,
    });

    const { container } = render(<AdminPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  test('loads and displays user list for ADMIN user', async () => {
    const mockUsers = [
      { id: 1, firstName: 'Super', lastName: 'Admin', email: 'admin@ifpc.eu', role: 'ADMIN' },
      { id: 2, firstName: 'Paul', lastName: 'Durand', email: 'paul@ifpc.eu', role: 'USER' },
    ];
    (api.getUsers as jest.Mock).mockResolvedValue(mockUsers);

    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByText('Paul Durand')).toBeInTheDocument();
      expect(screen.getByText('paul@ifpc.eu')).toBeInTheDocument();
    });
  });

  test('filters user list when search term is typed', async () => {
    const mockUsers = [
      { id: 1, firstName: 'Super', lastName: 'Admin', email: 'admin@ifpc.eu', role: 'ADMIN' },
      { id: 2, firstName: 'Paul', lastName: 'Durand', email: 'paul@ifpc.eu', role: 'USER' },
    ];
    (api.getUsers as jest.Mock).mockResolvedValue(mockUsers);

    render(<AdminPanel />);

    await waitFor(() => expect(screen.getByText('Paul Durand')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(searchInput, { target: { value: 'Paul' } });

    expect(screen.getByText('Paul Durand')).toBeInTheDocument();
    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();
  });
});
