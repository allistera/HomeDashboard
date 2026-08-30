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
  watchedEntityIds,
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
    expect(new Set(cameraBindings.map((item) => item.entityId)).size).toBe(cameraBindings.length);
  });

  it("lists each consumed entity id once for the live subscription", () => {
    const ids = watchedEntityIds();

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("light.living_room_livingroom_light_2");
    expect(ids).toContain(homePageBindings.camera.entityId);
    expect(ids).toContain("camera.back_garden");
    expect(ids).toContain(securityPageBindings.alarmControlPanel.entityId);
    expect(ids).not.toContain(homePageBindings.actions.goodNight.entityId);
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
