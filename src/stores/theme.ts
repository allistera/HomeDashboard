import { defineStore } from "pinia";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  systemDark: boolean;
}

const MODES: ThemeMode[] = ["light", "dark", "system"];

// Guards against stacking duplicate OS-theme listeners if watchSystem is
// ever called more than once (e.g. App remounting).
let systemWatcherAttached = false;

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export const useThemeStore = defineStore("theme", {
  state: (): ThemeState => ({
    mode: "light",
    systemDark: systemPrefersDark(),
  }),
  getters: {
    dark(state): boolean {
      return state.mode === "system" ? state.systemDark : state.mode === "dark";
    },
  },
  actions: {
    setMode(mode: ThemeMode) {
      this.mode = mode;
    },
    cycle() {
      this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    },
    // Keeps "system" mode in sync with OS-level theme changes made while the app is open.
    watchSystem() {
      if (systemWatcherAttached) return;
      systemWatcherAttached = true;
      window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
        this.systemDark = event.matches;
      });
    },
  },
});
