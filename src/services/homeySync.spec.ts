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

  it("discovers named people across zones without counting occupancy sensors", () => {
    const resident = new TestDevice("resident", { presence: true });
    resident.class = "sensor";
    resident.name = "Alex";
    const visitor = new TestDevice("visitor", { presence: false });
    visitor.class = "sensor";
    visitor.name = "Casey";
    const occupancy = new TestDevice("occupancy", { alarm_presence: true, alarm_motion: true });
    occupancy.class = "sensor";
    applyDevices(new Map([resident, visitor, occupancy].map((device) => [device.id, device])));

    const security = useSecurityStore();
    expect(
      security.people.map(({ id, name, home, status }) => ({ id, name, home, status })),
    ).toEqual([
      { id: "resident", name: "Alex", home: true, status: "HOME" },
      { id: "visitor", name: "Casey", home: false, status: "AWAY" },
    ]);
    expect(security.peopleHome).toBe(1);

    resident.available = false;
    applyDevices(new Map([[resident.id, resident]]));
    expect(security.people[0]?.status).toBe("UNAVAILABLE");
    expect(security.peopleHome).toBe(0);
    applyDevices(new Map());
    expect(security.people).toEqual([]);
  });

  it.each([null, "true", "false", 1, 0])(
    "marks non-boolean presence %s as unavailable",
    (value) => {
      const person = new TestDevice("resident", { presence: value });
      applyDevices(new Map([[person.id, person]]));
      expect(useSecurityStore().people[0]?.status).toBe("UNAVAILABLE");
      expect(useSecurityStore().peopleHome).toBe(0);
    },
  );

  it("marks a missing presence reading as unavailable", () => {
    const person = new TestDevice("resident", {});
    person.capabilities = ["presence"];
    applyDevices(new Map([[person.id, person]]));
    expect(useSecurityStore().people[0]?.status).toBe("UNAVAILABLE");
    expect(useSecurityStore().peopleHome).toBe(0);
  });

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
