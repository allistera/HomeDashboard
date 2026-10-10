import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import {
  livingRoomMediaBinding,
  roomBindingFor,
} from "@/services/homeyBindings/homeyRoomsBindings";
import { applyDevices, lightLevelFrom, numericCapabilityFrom } from "@/services/homeySync";
import type { HomeyDevice } from "@/services/homeyTypes";
import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { TestDevice } from "@/services/homeyTestSupport";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

describe("Homey device synchronization", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("maps camera snapshots by zone and clears removed cameras", () => {
    const camera: HomeyDevice = new TestDevice("camera", {});
    camera.class = "camera";
    camera.zone = homePageBindings.roomZoneIds["living-room"]!;
    camera.images = [{ imageObj: { url: "/api/image/snapshot" } }];
    applyDevices(new Map([[camera.id, camera]]));
    expect(useRoomsStore().selectedRoom.camera?.snapshotUrl).toBe("/api/image/snapshot");
    camera.available = false;
    applyDevices(new Map([[camera.id, camera]]));
    expect(useRoomsStore().selectedRoom.camera?.available).toBe(false);
    applyDevices(new Map());
    expect(useRoomsStore().selectedRoom.camera).toBeUndefined();
  });

  it("links by device ID even if the display name changes", () => {
    const speaker = new TestDevice(livingRoomMediaBinding.deviceId, {
      speaker_playing: true,
      speaker_track: "Night Jazz",
      sonos_group: "Beam",
    });
    speaker.name = "Renamed speaker";
    applyDevices(new Map([[speaker.id, speaker]]));
    expect(useRoomsStore().selectedRoom.media).toEqual({
      title: "Night Jazz",
      playing: true,
      active: true,
      output: "Beam",
    });
    speaker.capabilitiesObj.speaker_playing.value = false;
    applyDevices(new Map([[speaker.id, speaker]]));
    expect(useRoomsStore().selectedRoom.media?.playing).toBe(false);
  });

  it("maps motion and its timestamp in both linked rooms", () => {
    const hallway = new TestDevice(roomBindingFor("hallway")!.motion!.deviceId, {
      alarm_motion: true,
    });
    const toilet = new TestDevice(roomBindingFor("toilet")!.motion!.deviceId, {
      alarm_motion: false,
    });
    applyDevices(
      new Map([
        [hallway.id, hallway],
        [toilet.id, toilet],
      ]),
    );
    const rooms = useRoomsStore().rooms;
    expect(rooms.find((room) => room.id === "hallway")?.motion?.active).toBe(true);
    expect(rooms.find((room) => room.id === "toilet")?.motion?.active).toBe(false);
    expect(rooms.find((room) => room.id === "hallway")?.motion?.lastChangedAt).toBe(
      Date.parse("2026-10-02T12:00:00Z"),
    );
  });

  it("clears demonstration and stale readings when devices are missing or unavailable", () => {
    const speaker = new TestDevice(livingRoomMediaBinding.deviceId, { speaker_playing: true });
    applyDevices(new Map([[speaker.id, speaker]]));
    speaker.available = false;
    applyDevices(new Map([[speaker.id, speaker]]));
    const rooms = useRoomsStore();
    const security = useSecurityStore();
    expect(rooms.selectedRoom.media).toBeUndefined();
    expect(
      rooms.rooms.every(
        (room) => room.lights.length === 0 && room.temp === null && room.target === null,
      ),
    ).toBe(true);
    expect(rooms.outsideTemp).toBeNull();
    expect(rooms.houseTemp).toBeNull();
    expect(rooms.houseTarget).toBeNull();
    expect(rooms.washingLabel).toContain("UNAVAILABLE");
    expect(security.entries).toEqual([]);
    expect(security.allSecure).toBe(false);
    expect(security.armLabel).toBe("ALARM UNAVAILABLE");
    expect(security.cameras.every((camera) => !camera.live && !camera.streamUrl)).toBe(true);
    expect(security.people.every((person) => person.status === "UNAVAILABLE")).toBe(true);
  });

  it("scales Homey's dim capability and ignores invalid numeric readings", () => {
    const light = new TestDevice("light-id", { onoff: true, dim: 0.42, measure_temperature: null });
    expect(lightLevelFrom(light)).toBe(42);
    light.capabilitiesObj.onoff.value = false;
    expect(lightLevelFrom(light)).toBe(0);
    light.capabilitiesObj.onoff.value = true;
    light.capabilitiesObj.dim.value = 1.5;
    expect(lightLevelFrom(light)).toBe(100);
    const binding = { deviceId: light.id, capabilityId: "measure_temperature" };
    expect(numericCapabilityFrom(new Map([[light.id, light]]), binding)).toBeNull();
    light.capabilitiesObj.measure_temperature.value = 0;
    expect(numericCapabilityFrom(new Map([[light.id, light]]), binding)).toBe(0);
    light.available = false;
    expect(numericCapabilityFrom(new Map([[light.id, light]]), binding)).toBeNull();
  });
});
