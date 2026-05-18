import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { immer } from "zustand/middleware/immer";

// TODO: expand as we add global preferences, active project context, etc.
export interface AppState {
  addProjectOpen: boolean;
}

export interface AppActions {
  setAddProjectOpen(open: boolean): void;
}

export type AppStore = AppState & AppActions;

const initialState: AppState = {
  addProjectOpen: false,
};

export function createAppStore(initial: Partial<AppState> = {}) {
  return createStore<AppStore>()(
    immer((set) => ({
      ...initialState,
      ...initial,
      setAddProjectOpen(open) {
        set((state) => {
          state.addProjectOpen = open;
        });
      },
    })),
  );
}

export const appStore = createAppStore();

export function useAppStore<T>(selector: (state: AppStore) => T): T {
  return useStore(appStore, selector);
}
