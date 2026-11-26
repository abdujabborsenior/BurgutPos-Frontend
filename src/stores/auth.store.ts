import { create } from 'zustand';
import type { Profile } from '@/api/types';
import type { Permission } from '@/lib/permissions';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: Profile | null;
  /** Kept in memory only — the long-lived credential is an httpOnly cookie. */
  accessToken: string | null;
  setSession: (accessToken: string, user: Profile) => void;
  setUser: (user: Profile) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'checking',
  user: null,
  accessToken: null,
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null, status: 'anonymous' }),
}));

export function hasPermission(user: Profile | null, permission: Permission): boolean {
  if (!user) return false;
  return user.isSuperadmin || user.permissions.includes(permission);
}

/** Reactive permission check: `useCan(Permission.MenuManage)`. */
export function useCan(permission: Permission | Permission[], mode: 'all' | 'any' = 'all'): boolean {
  const user = useAuthStore((state) => state.user);
  const list = Array.isArray(permission) ? permission : [permission];
  return mode === 'all'
    ? list.every((item) => hasPermission(user, item))
    : list.some((item) => hasPermission(user, item));
}
