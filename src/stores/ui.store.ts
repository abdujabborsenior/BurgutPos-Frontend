import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  openGroups: string[];
  toggleSidebar: () => void;
  setMobileSidebar: (open: boolean) => void;
  toggleGroup: (key: string) => void;
  openGroup: (key: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      openGroups: [],
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setMobileSidebar: (open) => set({ mobileSidebarOpen: open }),
      toggleGroup: (key) =>
        set((state) => ({
          openGroups: state.openGroups.includes(key)
            ? state.openGroups.filter((group) => group !== key)
            : [...state.openGroups, key],
        })),
      openGroup: (key) =>
        set((state) =>
          state.openGroups.includes(key) ? state : { openGroups: [...state.openGroups, key] },
        ),
    }),
    {
      name: 'bp-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, openGroups: state.openGroups }),
    },
  ),
);
