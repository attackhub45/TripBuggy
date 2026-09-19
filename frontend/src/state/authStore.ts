import { create } from 'zustand';
import { auth, isAuthenticated, logout as clearSession, type ApiUser } from '../api/client';

/** The silent per-browser account created by ensureAuthenticated() — not a real login. */
export function isDeviceAccount(email: string): boolean {
  return /^device-[0-9a-f-]+@tripbuggy-device\.com$/i.test(email);
}

interface AuthState {
  user: ApiUser | null;
  checked: boolean;

  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  checked: false,

  checkAuth: async () => {
    if (!isAuthenticated()) {
      set({ user: null, checked: true });
      return;
    }
    try {
      const user = await auth.me();
      set({ user, checked: true });
    } catch {
      set({ user: null, checked: true });
    }
  },

  login: async (email, password) => {
    const user = await auth.login(email, password);
    set({ user, checked: true });
  },

  signup: async (email, password, displayName) => {
    const user = await auth.signup(email, password, displayName);
    set({ user, checked: true });
  },

  logout: () => {
    clearSession();
    set({ user: null, checked: true });
  },
}));
