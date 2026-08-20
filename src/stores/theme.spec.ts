import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeStore } from "@/stores/theme";

function mockMatchMedia(matches: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  vi.stubGlobal("matchMedia", (_query: string) => ({
    matches,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
      listeners.push(listener);
    },
  }));
  return {
    fire: (next: boolean) => {
      for (const listener of listeners) listener({ matches: next });
    },
  };
}

describe("theme store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in light mode", () => {
    const theme = useThemeStore();
    expect(theme.mode).toBe("light");
    expect(theme.dark).toBe(false);
  });

  it("cycles light -> dark -> system -> light", () => {
    const theme = useThemeStore();
    theme.cycle();
    expect(theme.mode).toBe("dark");
    expect(theme.dark).toBe(true);

    theme.cycle();
    expect(theme.mode).toBe("system");

    theme.cycle();
    expect(theme.mode).toBe("light");
    expect(theme.dark).toBe(false);
  });

  it("resolves system mode from the OS preference", () => {
    mockMatchMedia(true);
    const theme = useThemeStore();
    theme.setMode("system");
    expect(theme.dark).toBe(true);
  });

  it("updates system mode when the OS preference changes while watching", () => {
    const media = mockMatchMedia(false);
    const theme = useThemeStore();
    theme.setMode("system");
    theme.watchSystem();
    expect(theme.dark).toBe(false);

    media.fire(true);
    expect(theme.dark).toBe(true);
  });
});
