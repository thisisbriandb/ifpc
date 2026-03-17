import { create } from 'zustand';
import { getMe, logout as apiLogout } from './api';

interface User {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  checkAuth: async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        set({ user: null, isLoading: false });
        return;
      }
      const data = await getMe();
      set({ user: data, isLoading: false });
    } catch {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        document.cookie = "token=; path=/; max-age=0";
      }
      set({ user: null, isLoading: false });
    }
  },
  logout: () => {
    apiLogout();
    set({ user: null });
  },
  setUser: (user) => set({ user }),
}));
