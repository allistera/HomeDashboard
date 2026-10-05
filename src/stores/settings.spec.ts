import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOMEY_TOKEN_KEY, HOMEY_URL_KEY, normalizeUrl, useSettingsStore } from "@/stores/settings";

describe("normalizeUrl", () => {
  it("adds a protocol when missing and strips trailing slashes", () => {
    expect(normalizeUrl("homey.local/")).toBe("https://homey.local");
    expect(normalizeUrl("http://homey.local//")).toBe("http://homey.local");
    expect(normalizeUrl("  ")).toBe("");
  });
});

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts unconfigured, then loads saved values from localStorage", () => {
    expect(useSettingsStore().configured).toBe(false);

    localStorage.setItem(HOMEY_URL_KEY, "http://homey.local");
    localStorage.setItem(HOMEY_TOKEN_KEY, "token-123");
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    expect(settings.configured).toBe(true);
    expect(settings.url).toBe("http://homey.local");
  });

  it("validates against the Homey API and saves on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("homey.local/", " token-123 ");

    expect(saved).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://homey.local/api/manager/devices/device", {
      headers: { Authorization: "Bearer token-123" },
    });
    expect(settings.validation).toBe("valid");
    expect(localStorage.getItem(HOMEY_URL_KEY)).toBe("https://homey.local");
    expect(localStorage.getItem(HOMEY_TOKEN_KEY)).toBe("token-123");
  });

  it("reports a rejected token and saves nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("http://homey.local", "bad-token");

    expect(saved).toBe(false);
    expect(settings.validation).toBe("error");
    expect(settings.message).toContain("rejected the token");
    expect(localStorage.getItem(HOMEY_URL_KEY)).toBeNull();
  });

  it("reports an unreachable instance and saves nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("http://homey.local", "token-123");

    expect(saved).toBe(false);
    expect(settings.validation).toBe("error");
    expect(settings.message).toContain("Could not reach");
    expect(localStorage.getItem(HOMEY_TOKEN_KEY)).toBeNull();
  });

  it("rejects empty input without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const settings = useSettingsStore();
    expect(await settings.validateAndSave("", "")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears saved settings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const settings = useSettingsStore();
    await settings.validateAndSave("http://homey.local", "token-123");
    settings.clear();

    expect(settings.configured).toBe(false);
    expect(localStorage.getItem(HOMEY_URL_KEY)).toBeNull();
    expect(localStorage.getItem(HOMEY_TOKEN_KEY)).toBeNull();
  });
});
