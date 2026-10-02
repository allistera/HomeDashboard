import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  connectHomey,
  disconnectHomey,
  setHomeyCapability,
  setHomeyLight,
} from "@/services/homeyClient";
import {
  livingRoomMediaBinding,
  roomBindingFor,
  roomBindings,
} from "@/services/homeyBindings/homeyRoomsBindings";
import { subscribeHomeyDevices } from "@/services/homeySubscribe";
import { TestDevice, TestHomey } from "@/services/homeyTestSupport";
import type { HomeyConnection, HomeyDevice } from "@/services/homeyTypes";
import { applyDevices } from "@/services/homeySync";
import { useActivityStore } from "@/stores/activity";
import { useHomeyStore } from "@/stores/homey";
import { useRoomsStore } from "@/stores/rooms";
import { useSettingsStore } from "@/stores/settings";

describe("Homey client", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    useSettingsStore().url = "https://homey.example";
    useSettingsStore().token = "test-token";
  });
  afterEach(() => disconnectHomey());

  it("loads devices and live updates, records activity by device ID, and cleans up", async () => {
    const speaker = new TestDevice(livingRoomMediaBinding.deviceId, {
      speaker_playing: true,
      speaker_track: "Jazz",
    });
    const motion = new TestDevice(roomBindingFor("hallway")!.motion!.deviceId, {
      alarm_motion: false,
    });
    const homey = new TestHomey([speaker, motion]);
    expect(await connectHomey(applyDevices, async () => homey)).toBe(true);
    expect(useHomeyStore().status).toBe("connected");
    expect(useHomeyStore().deviceCount).toBe(2);
    expect(useActivityStore().events).toEqual([]);
    motion.emit("alarm_motion", true);
    expect(useRoomsStore().rooms.find((room) => room.id === "hallway")?.motion?.active).toBe(true);
    expect(useActivityStore().events[0]?.sourceId).toBe(motion.id);
    expect(useActivityStore().events[0]?.text).toContain("detected motion");
    homey.emitDevice("device.delete", speaker);
    expect(useRoomsStore().selectedRoom.media).toBeUndefined();
    disconnectHomey();
    expect(homey.destroyed).toBe(true);
    expect(motion.destroyed).toBe(1);
    expect(speaker.destroyed).toBe(2);
    const count = useActivityStore().events.length;
    motion.emit("alarm_motion", false);
    expect(useActivityStore().events).toHaveLength(count);
  });

  it("writes media capabilities and restores optimistic state on rejection", async () => {
    const speaker = new TestDevice(livingRoomMediaBinding.deviceId, {
      speaker_playing: true,
      speaker_prev: null,
      speaker_next: null,
    });
    const homey = new TestHomey([speaker]);
    await connectHomey(applyDevices, async () => homey);
    await useRoomsStore().controlMedia("living-room", "toggle");
    await useRoomsStore().controlMedia("living-room", "next");
    expect(speaker.commands).toEqual([
      { capabilityId: "speaker_playing", value: false },
      { capabilityId: "speaker_next", value: true },
    ]);
    speaker.failWrites = true;
    await useRoomsStore().controlMedia("living-room", "toggle");
    expect(useRoomsStore().selectedRoom.media?.playing).toBe(false);
    expect(await setHomeyCapability(speaker.id, "missing", true)).toBe("failed");
    homey.emit("disconnect");
    expect(await setHomeyCapability(speaker.id, "speaker_playing", true)).toBe("offline");
    expect(useHomeyStore().status).toBe("connecting");
  });

  it("converts dashboard brightness percentages to Homey's 0–1 scale", async () => {
    const binding = roomBindingFor("living-room")!;
    const light = new TestDevice("test-light-id", { onoff: false, dim: 0 });
    binding.lights.push({ lightId: "test-light", deviceId: light.id });
    try {
      await connectHomey(applyDevices, async () => new TestHomey([light]));
      expect(await setHomeyLight(light.id, 35)).toBe("sent");
      expect(light.commands).toEqual([
        { capabilityId: "onoff", value: true },
        { capabilityId: "dim", value: 0.35 },
      ]);
      light.available = false;
      expect(await setHomeyLight(light.id, 50)).toBe("failed");
    } finally {
      binding.lights.pop();
    }
  });

  it("destroys an obsolete connection without replacing a newer one", async () => {
    const old = new TestHomey([]);
    const current = new TestHomey([]);
    let resolveOld: (connection: HomeyConnection) => void = () => {};
    const pending = new Promise<HomeyConnection>((resolve) => {
      resolveOld = resolve;
    });
    const first = connectHomey(applyDevices, () => pending);
    expect(await connectHomey(applyDevices, async () => current)).toBe(true);
    resolveOld(old);
    expect(await first).toBe(false);
    expect(old.destroyed).toBe(true);
    expect(current.destroyed).toBe(false);
    expect(useHomeyStore().status).toBe("connected");
  });

  it("reports subscription failures and destroys partial capability listeners", async () => {
    const speaker = new TestDevice(livingRoomMediaBinding.deviceId, { speaker_playing: true });
    speaker.failConnect = true;
    const homey = new TestHomey([speaker]);
    expect(await connectHomey(applyDevices, async () => homey)).toBe(false);
    expect(homey.destroyed).toBe(true);
    expect(speaker.destroyed).toBe(1);
    expect(useHomeyStore().status).toBe("error");
    expect(useActivityStore().status).toBe("error");
  });

  it("reconciles a watched device that appears after the initial inventory", async () => {
    const homey = new TestHomey([]);
    let latest = new Map<string, HomeyDevice>();
    const stop = await subscribeHomeyDevices(
      homey,
      (devices) => {
        latest = devices;
      },
      () => {},
    );
    const speaker = new TestDevice(livingRoomMediaBinding.deviceId, { speaker_playing: false });
    homey.emitDevice("device.create", speaker);
    await Promise.resolve();
    await Promise.resolve();
    expect(latest.get(speaker.id)).toBe(speaker);
    stop();
    expect(speaker.destroyed).toBe(1);
    expect(roomBindings.some((binding) => binding.roomId === "toilet")).toBe(true);
  });
});
