import { create } from 'zustand';
import type { PresenceUser } from '@/api/types';

interface PresenceState {
  connected: boolean;
  users: PresenceUser[];
  setConnected: (connected: boolean) => void;
  setUsers: (users: PresenceUser[]) => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  connected: false,
  users: [],
  setConnected: (connected) => set({ connected }),
  setUsers: (users) => set({ users }),
}));
