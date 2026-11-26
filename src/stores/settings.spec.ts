import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeAssistantSocket } from "@/services/haTestSupport";
import { HA_TOKEN_KEY, HA_URL_KEY, normalizeUrl, useSettingsStore } from "@/stores/settings";

describe("normalizeUrl", () => {
  it("adds a protocol when missing and strips trailing slashes", () => {
    expect(normalizeUrl("homeassistant.local:8123/")).toBe("https://homeassistant.local:8123");
    expect(normalizeUrl("http://ha.local:8123//")).toBe("http://ha.local:8123");
    expect(normalizeUrl("  ")).toBe("");
  });
});

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.stubGlobal("WebSocket", HomeAssistantSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts unconfigured, then loads saved values from localStorage", () => {
    expect(useSettingsStore().configured).toBe(false);

    localStorage.setItem(HA_URL_KEY, "http://ha.local:8123");
    localStorage.setItem(HA_TOKEN_KEY, "token-123");
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    expect(settings.configured).toBe(true);
    expect(settings.url).toBe("http://ha.local:8123");
  });

  it("authenticates via WebSocket before saving the connection", async () => {
    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("ha.local:8123/", " token-123 ");
    const socket = HomeAssistantSocket.active;

    expect(saved).toBe(true);
    expect(socket.url).toBe("wss://ha.local:8123/api/websocket");
    expect(socket.requests[0]).toMatchObject({ type: "auth", access_token: "token-123" });
    expect(settings.validation).toBe("valid");
    expect(localStorage.getItem(HA_URL_KEY)).toBe("https://ha.local:8123");
    expect(localStorage.getItem(HA_TOKEN_KEY)).toBe("token-123");
  });

  it("reports a rejected token and saves nothing", async () => {
    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("http://ha.local:8123", "bad-token");
    expect(saved).toBe(false);
    expect(settings.validation).toBe("error");
    expect(settings.message).toContain("rejected the token");
    expect(localStorage.getItem(HA_URL_KEY)).toBeNull();
  });

  it("reports an unreachable instance and saves nothing", async () => {
    class UnreachableWebSocket extends EventTarget {
      constructor() {
        super();
        queueMicrotask(() => this.dispatchEvent(new Event("error")));
      }
    }
    vi.stubGlobal("WebSocket", UnreachableWebSocket);
    const settings = useSettingsStore();
    const saved = await settings.validateAndSave("http://ha.local:8123", "token-123");
    expect(saved).toBe(false);
    expect(settings.message).toContain("Could not reach");
    expect(localStorage.getItem(HA_TOKEN_KEY)).toBeNull();
  });

  it("rejects empty or invalid input before opening a socket", async () => {
    const socket = vi.fn();
    vi.stubGlobal("WebSocket", socket);
    const settings = useSettingsStore();
    expect(await settings.validateAndSave("", "")).toBe(false);
    expect(await settings.validateAndSave("https://ha.local/path", "token-123")).toBe(false);
    expect(socket).not.toHaveBeenCalled();
  });

  it("clears saved settings", async () => {
    const settings = useSettingsStore();
    await settings.validateAndSave("http://ha.local:8123", "token-123");
    settings.clear();
    expect(settings.configured).toBe(false);
    expect(localStorage.getItem(HA_URL_KEY)).toBeNull();
    expect(localStorage.getItem(HA_TOKEN_KEY)).toBeNull();
  });
});
