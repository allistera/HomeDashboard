import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HA_HOUSE_TARGET_ATTRIBUTE_KEY,
  HA_HOUSE_TARGET_ENTITY_KEY,
  HA_HOUSE_TEMP_ATTRIBUTE_KEY,
  HA_HOUSE_TEMP_ENTITY_KEY,
  HA_TOKEN_KEY,
  HA_URL_KEY,
  normalizeUrl,
  useSettingsStore,
} from "@/stores/settings";

describe("normalizeUrl", () => {
  it("adds a protocol when missing and strips trailing slashes", () => {
    expect(normalizeUrl("homeassistant.local:8123/")).toBe("http://homeassistant.local:8123");
    expect(normalizeUrl("https://ha.example.com//")).toBe("https://ha.example.com");
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

    localStorage.setItem(HA_URL_KEY, "http://ha.local:8123");
    localStorage.setItem(HA_TOKEN_KEY, "token-123");
    localStorage.setItem(HA_HOUSE_TEMP_ENTITY_KEY, "climate.house");
    localStorage.setItem(HA_HOUSE_TEMP_ATTRIBUTE_KEY, "current_temperature");
    localStorage.setItem(HA_HOUSE_TARGET_ENTITY_KEY, "climate.house");
    localStorage.setItem(HA_HOUSE_TARGET_ATTRIBUTE_KEY, "temperature");
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    expect(settings.configured).toBe(true);
    expect(settings.url).toBe("http://ha.local:8123");
    expect(settings.houseTempEntity).toBe("climate.house");
    expect(settings.houseTempAttribute).toBe("current_temperature");
    expect(settings.houseTargetEntity).toBe("climate.house");
    expect(settings.houseTargetAttribute).toBe("temperature");
  });

  it("validates against the HA API and saves on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("ha.local:8123/", " token-123 ");

    expect(saved).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://ha.local:8123/api/", {
      headers: { Authorization: "Bearer token-123" },
    });
    expect(settings.validation).toBe("valid");
    expect(localStorage.getItem(HA_URL_KEY)).toBe("http://ha.local:8123");
    expect(localStorage.getItem(HA_TOKEN_KEY)).toBe("token-123");
  });

  it("trims and saves house climate entity properties", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const settings = useSettingsStore();
    await settings.validateAndSave("http://ha.local:8123", "token-123", {
      houseTempEntity: " climate.house ",
      houseTempAttribute: " current_temperature ",
      houseTargetEntity: " input_number.house_target ",
      houseTargetAttribute: " ",
    });

    expect(localStorage.getItem(HA_HOUSE_TEMP_ENTITY_KEY)).toBe("climate.house");
    expect(localStorage.getItem(HA_HOUSE_TEMP_ATTRIBUTE_KEY)).toBe("current_temperature");
    expect(localStorage.getItem(HA_HOUSE_TARGET_ENTITY_KEY)).toBe("input_number.house_target");
    expect(localStorage.getItem(HA_HOUSE_TARGET_ATTRIBUTE_KEY)).toBe("");
  });

  it("reports a rejected token and saves nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("http://ha.local:8123", "bad-token");

    expect(saved).toBe(false);
    expect(settings.validation).toBe("error");
    expect(settings.message).toContain("rejected the token");
    expect(localStorage.getItem(HA_URL_KEY)).toBeNull();
  });

  it("reports an unreachable instance and saves nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("http://ha.local:8123", "token-123");

    expect(saved).toBe(false);
    expect(settings.validation).toBe("error");
    expect(settings.message).toContain("Could not reach");
    expect(localStorage.getItem(HA_TOKEN_KEY)).toBeNull();
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
    await settings.validateAndSave("http://ha.local:8123", "token-123");
    settings.clear();

    expect(settings.configured).toBe(false);
    expect(localStorage.getItem(HA_URL_KEY)).toBeNull();
    expect(localStorage.getItem(HA_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(HA_HOUSE_TEMP_ENTITY_KEY)).toBeNull();
    expect(localStorage.getItem(HA_HOUSE_TEMP_ATTRIBUTE_KEY)).toBeNull();
    expect(localStorage.getItem(HA_HOUSE_TARGET_ENTITY_KEY)).toBeNull();
    expect(localStorage.getItem(HA_HOUSE_TARGET_ATTRIBUTE_KEY)).toBeNull();
  });
});
