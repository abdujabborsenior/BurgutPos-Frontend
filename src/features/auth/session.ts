import { authApi } from '@/api/auth.api';
import { refreshSession } from '@/api/http';
import { queryClient } from '@/app/query-client';
import { connectRealtime, disconnectRealtime } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth.store';

/** Restores the session from the httpOnly refresh cookie on app start. */
export async function bootstrapSession(): Promise<void> {
  const token = await refreshSession();
  if (token) connectRealtime();
  else useAuthStore.getState().clear();
}

export async function signIn(login: string, password: string): Promise<void> {
  const { accessToken, user } = await authApi.login(login, password);
  queryClient.clear();
  useAuthStore.getState().setSession(accessToken, user);
  connectRealtime();
}

export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    /* the session is dropped locally regardless */
  }
  disconnectRealtime();
  useAuthStore.getState().clear();
  queryClient.clear();
  sessionStorage.removeItem('bp-carts');
}
