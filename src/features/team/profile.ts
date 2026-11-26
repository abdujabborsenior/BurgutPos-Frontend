import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Re-reads the signed-in user's profile after they changed their own account
 * or role, so the menu and route guards reflect the new permissions at once.
 */
export async function refreshOwnProfile(): Promise<void> {
  try {
    useAuthStore.getState().setUser(await authApi.me());
  } catch {
    // Non-critical: the profile is re-read with the next session refresh.
  }
}
