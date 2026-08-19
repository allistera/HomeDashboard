import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import {
  cameraBindings,
  entryBindings,
  floorsPageBindings,
  homePageBindings,
  personBindings,
  roomBindings,
  securityPageBindings,
} from "@/services/haBindings";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

describe("Home Assistant binding completeness", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("binds every rendered room device to a Home Assistant entity", () => {
    const rooms = useRoomsStore();

    for (const room of rooms.rooms) {
      const binding = roomBindings.find((item) => item.roomId === room.id);
      expect(binding, `${room.name} has a room binding`).toBeDefined();
      expect(binding!.lights.map((item) => item.lightId).sort()).toEqual(
        room.lights.map((item) => item.id).sort(),
      );
      expect(binding!.covers.map((item) => item.blindId).sort()).toEqual(
        room.blinds.map((item) => item.id).sort(),
      );
      if (room.media) expect(binding!.media).toBeTruthy();
      if (room.motion) expect(binding!.motion).toBeTruthy();
      if (room.vacuum) expect(binding!.vacuum).toBeTruthy();
    }
  });

  it("binds every rendered security entry, camera, and resident", () => {
    const security = useSecurityStore();

    expect(entryBindings.map((item) => item.entryId).sort()).toEqual(
      security.entries.map((item) => item.id).sort(),
    );
    expect(cameraBindings.map((item) => item.cameraId).sort()).toEqual(
      security.cameras.map((item) => item.id).sort(),
    );
    expect(personBindings.map((item) => item.personId).sort()).toEqual(
      security.people
        .filter((item) => !item.guest)
        .map((item) => item.id)
        .sort(),
    );
    expect(securityPageBindings.alarmControlPanel.entityId).toBeTruthy();
  });

  it("keeps page-level selections connected to configured entities", () => {
    const roomIds = new Set(roomBindings.map((binding) => binding.roomId));

    expect(roomIds.has(homePageBindings.mediaPlayer.roomId)).toBe(true);
    expect(cameraBindings).toContain(homePageBindings.camera);
    expect(Object.values(homePageBindings.actions).every((action) => action.entityId !== "")).toBe(
      true,
    );
    expect(roomIds.has(floorsPageBindings.kitchenRoomId)).toBe(true);
    expect(roomIds.has(floorsPageBindings.livingRoomId)).toBe(true);
    expect(roomIds.has(floorsPageBindings.hallwayRoomId)).toBe(true);
    expect(floorsPageBindings.bedroomRoomIds.every((roomId) => roomIds.has(roomId))).toBe(true);
  });
});
