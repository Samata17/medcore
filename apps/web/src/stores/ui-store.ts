import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Per-browser UI preferences (safe to lose; never contains patient data). */
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    // Private mode / blocked storage: fall back to a no-op store.
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
});

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "medcore-ui", storage: safeStorage },
  ),
);
