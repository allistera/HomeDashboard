import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useRoomsStore } from "@/stores/rooms";

describe("rooms store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("counts lights that are on in a room", () => {
    const rooms = useRoomsStore();
    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(rooms.lightsOn(livingRoom)).toBe(2);
  });

  it("turns a whole room on and off", () => {
    const rooms = useRoomsStore();
    rooms.setRoomLights("living-room", false);
    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(rooms.lightsOn(livingRoom)).toBe(0);

    rooms.setRoomLights("living-room", true);
    expect(rooms.lightsOn(livingRoom)).toBe(livingRoom.lights.length);
  });

  it("turns every light in the house off", () => {
    const rooms = useRoomsStore();
    expect(rooms.anyLightOn).toBe(true);
    rooms.setAllLights(false);
    expect(rooms.anyLightOn).toBe(false);
  });

  it("applies scenes to a room", () => {
    const rooms = useRoomsStore();
    rooms.applyScene("living-room", "bright");
    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(livingRoom.lights.every((l) => l.level === 100)).toBe(true);

    rooms.applyScene("living-room", "all-off");
    expect(livingRoom.lights.every((l) => l.level === 0)).toBe(true);
  });

  it("adjusts the target temperature in half-degree steps", () => {
    const rooms = useRoomsStore();
    rooms.adjustTarget("living-room", 0.5);
    expect(rooms.selectedRoom.target).toBe(22);
    rooms.adjustTarget("living-room", -0.5);
    expect(rooms.selectedRoom.target).toBe(21.5);
  });

  it("uses Home Assistant house climate values when available", () => {
    const rooms = useRoomsStore();
    rooms.setHomeClimateValues(8.4, 20.7, 21.5);
    expect(rooms.outsideTemp).toBe(8.4);
    expect(rooms.houseTemp).toBe(20.7);
    expect(rooms.houseTarget).toBe(21.5);

    rooms.setHomeClimateValues(null, null, null);
    expect(rooms.outsideTemp).toBe(12);
    expect(rooms.houseTemp).toBe(20.5);
    expect(rooms.houseTarget).toBe(21.5);
  });

  it("controls the configured room media player optimistically", () => {
    const rooms = useRoomsStore();
    const kitchen = rooms.rooms.find((room) => room.id === "kitchen")!;
    expect(kitchen.media!.playing).toBe(true);

    rooms.controlMedia("kitchen", "toggle");
    expect(kitchen.media!.playing).toBe(false);

    rooms.controlMedia("kitchen", "toggle");
    expect(kitchen.media!.playing).toBe(true);
  });

  it("switches the washing reminder on the drying-weather flag", () => {
    const rooms = useRoomsStore();
    expect(rooms.washingLabel).toBe("DO NOT PUT OUT THE WASHING");
    expect(rooms.washingTone).toBe("alert");

    rooms.setWashingWeather(true);
    expect(rooms.washingLabel).toBe("PUT OUT THE WASHING");
    expect(rooms.washingTone).toBe("ok");
  });

  it("ignores selecting a room that does not exist", () => {
    const rooms = useRoomsStore();
    rooms.selectRoom("garage-gym");
    expect(rooms.selectedRoomId).toBe("living-room");
  });
});
