import { render, screen } from '@testing-library/react';
import Sidebar from '@/components/Navbar';
import { SidebarProvider } from '@/lib/sidebar-context';
import { I18nProvider } from '@/lib/i18n';
import { useAuthStore } from '@/lib/store';

jest.mock('@/lib/api', () => ({
  getMe: jest.fn().mockImplementation(() => Promise.resolve(null)),
  logout: jest.fn(),
}));

describe('Sidebar / Navbar Component', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: false, checkAuth: jest.fn() });
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <I18nProvider>
        <SidebarProvider>
          <Sidebar />
        </SidebarProvider>
      </I18nProvider>
    );
  };

  test('renders login link when guest user', () => {
    renderComponent();
    expect(screen.getAllByTitle('Connexion')[0] || screen.getAllByText('Connexion')[0]).toBeInTheDocument();
  });

  test('renders user details or profile icon when logged in', () => {
    useAuthStore.setState({
      user: { firstName: 'Jean', lastName: 'Valjean', email: 'jean@ifpc.eu', role: 'USER' },
      isLoading: false,
      checkAuth: jest.fn(),
    });

    renderComponent();
    expect(screen.getByTitle('Mon profil')).toBeInTheDocument();
  });

  test('renders Admin link when user is ADMIN', () => {
    useAuthStore.setState({
      user: { firstName: 'Boss', lastName: 'Admin', email: 'admin@ifpc.eu', role: 'ADMIN' },
      isLoading: false,
      checkAuth: jest.fn(),
    });

    renderComponent();
    expect(screen.getByTitle('Admin')).toBeInTheDocument();
  });
});
