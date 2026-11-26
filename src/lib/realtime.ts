import type { QueryKey } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { refreshSession } from '@/api/http';
import type { PresenceUser } from '@/api/types';
import { queryClient } from '@/app/query-client';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';

/** Server invalidation scopes → query-key prefixes that become stale. */
const SCOPE_KEYS: Record<string, QueryKey[]> = {
  board: [['pos', 'board']],
  counters: [['pos', 'counters']],
  orders: [['orders']],
  stock: [['stock'], ['ingredients'], ['pos', 'menu'], ['dishes']],
  menu: [['dishes'], ['categories'], ['pos', 'menu'], ['stock', 'balance'], ['printers']],
  shift: [['shifts']],
  settings: [['settings']],
  halls: [['halls'], ['tables'], ['pos', 'board']],
  'payment-methods': [['payment-methods']],
  printers: [['printers']],
  dashboard: [['dashboard'], ['reports']],
  team: [['users'], ['roles']],
};

let socket: Socket | null = null;
let pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleInvalidation(scopes: string[]): void {
  for (const scope of scopes) pending.add(scope);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    const scopesToFlush = pending;
    pending = new Set();
    flushTimer = null;
    const seen = new Set<string>();
    for (const scope of scopesToFlush) {
      for (const key of SCOPE_KEYS[scope] ?? []) {
        const id = JSON.stringify(key);
        if (seen.has(id)) continue;
        seen.add(id);
        void queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, 120);
}

/** Same mapping, used after the client's own mutations. */
export function invalidateScopes(...scopes: string[]): void {
  scheduleInvalidation(scopes);
}

export function connectRealtime(): void {
  if (socket) return;
  socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  socket.on('connect', () => {
    usePresenceStore.getState().setConnected(true);
    // Anything may have changed while we were offline.
    void queryClient.invalidateQueries();
  });
  socket.on('disconnect', () => usePresenceStore.getState().setConnected(false));
  socket.on('invalidate', (payload: { scopes?: string[] }) => {
    if (Array.isArray(payload?.scopes)) scheduleInvalidation(payload.scopes);
  });
  socket.on('presence', (users: PresenceUser[]) => usePresenceStore.getState().setUsers(users));
  socket.on('auth_error', async () => {
    const token = await refreshSession();
    if (token && socket) {
      socket.disconnect();
      socket.connect();
    }
  });
}

export function disconnectRealtime(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  usePresenceStore.getState().setConnected(false);
  usePresenceStore.getState().setUsers([]);
}
