import { defineStore } from "pinia";

export const useThemeStore = defineStore("theme", {
  state: () => ({
    dark: false,
  }),
  actions: {
    toggle() {
      this.dark = !this.dark;
    },
  },
});
