import { useAuthStore } from '@/lib/store';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, isLoading: true });
    jest.clearAllMocks();
  });

  test('setUser updates user state', () => {
    const user = { firstName: 'Alice', lastName: 'Dupont', email: 'alice@ifpc.eu', role: 'ADMIN' };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  test('logout calls api.logout and clears user state', () => {
    const user = { firstName: 'Alice', lastName: 'Dupont', email: 'alice@ifpc.eu', role: 'ADMIN' };
    useAuthStore.setState({ user });

    useAuthStore.getState().logout();

    expect(api.logout).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('checkAuth sets user to null when no token present', async () => {
    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  test('checkAuth fetches user when token is present', async () => {
    localStorage.setItem('token', 'fake-jwt-token');
    const user = { firstName: 'Bob', lastName: 'Martin', email: 'bob@ifpc.eu', role: 'USER' };
    (api.getMe as jest.Mock).mockResolvedValue(user);

    await useAuthStore.getState().checkAuth();

    expect(api.getMe).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  test('checkAuth handles API failure by clearing token and setting user to null', async () => {
    localStorage.setItem('token', 'expired-token');
    (api.getMe as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    await useAuthStore.getState().checkAuth();

    expect(localStorage.getItem('token')).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
