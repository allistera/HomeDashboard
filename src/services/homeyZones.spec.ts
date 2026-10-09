import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { subscribeHomeyZones } from "@/services/homeyZones";
import { TestHomey } from "@/services/homeyTestSupport";
import { useZonesStore } from "@/stores/zones";
import { connectHomey, disconnectHomey } from "@/services/homeyClient";
import { applyDevices } from "@/services/homeySync";
import { useSettingsStore } from "@/stores/settings";
import { useHomeyStore } from "@/stores/homey";

describe("Homey zone activity", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("loads zone status, follows changes and deletions, refreshes on reconnect, and cleans up", async () => {
    const homey = new TestHomey([]);
    const zone = { id: "zone-id", active: false, activeLastUpdated: "2026-10-09T12:00:00Z" };
    homey.zoneInventory[zone.id] = zone;
    const stop = await subscribeHomeyZones(homey);
    const store = useZonesStore();
    expect(store.zones[zone.id]).toEqual(zone);
    homey.emitZone("zone.update", { ...zone, active: true });
    expect(store.zones[zone.id].active).toBe(true);
    homey.emit("disconnect");
    expect(store.zones).toEqual({});
    homey.emit("reconnect");
    await flushPromises();
    expect(store.zones[zone.id].active).toBe(false);
    homey.emitZone("zone.delete", zone);
    expect(store.zones).toEqual({});
    stop();
    homey.emitZone("zone.create", zone);
    homey.emit("reconnect");
    await flushPromises();
    expect(store.zones).toEqual({});
  });

  it("reports denied zone access without failing the device connection", async () => {
    const homey = new TestHomey([]);
    homey.failZones = true;
    useSettingsStore().url = "https://homey.example";
    useSettingsStore().token = "test-token";
    try {
      expect(await connectHomey(applyDevices, async () => homey)).toBe(true);
      expect(useHomeyStore().status).toBe("connected");
      expect(useZonesStore().unavailable).toBe(true);
      expect(useZonesStore().zones).toEqual({});
    } finally {
      disconnectHomey();
    }
  });

  it("ignores a late snapshot from an obsolete connection", async () => {
    const homey = new TestHomey([]);
    let current = true;
    let resolve = (_zones: Awaited<ReturnType<typeof homey.zones.getZones>>) => {};
    homey.zones.getZones = () =>
      new Promise((done) => {
        resolve = done;
      });
    const pending = subscribeHomeyZones(homey, () => current);
    await flushPromises();
    current = false;
    resolve({ old: { id: "old", active: true } });
    const stop = await pending;
    expect(useZonesStore().zones).toEqual({});
    stop();
  });
});
