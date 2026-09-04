import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { watchedEntityIds } from "@/services/haBindings/haGlobalBindings";
import { floorsPageBindings } from "@/services/haBindings/haFloorsBindings";
import { homePageBindings } from "@/services/haBindings/haHomeBindings";
import { roomBindings } from "@/services/haBindings/haRoomsBindings";
import {
  cameraBindings,
  entryBindings,
  personBindings,
  securityPageBindings,
} from "@/services/haBindings/haSecurityBindings";
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
      if (room.media) expect(binding!.media).toBeTruthy();
      if (room.motion) expect(binding!.motion).toBeTruthy();
      if (room.vacuum) expect(binding!.vacuum).toBeTruthy();
    }
  });

  it("omits placeholder lights from rooms with no Home Assistant lights", () => {
    const rooms = useRoomsStore();

    for (const roomId of ["kitchen", "jaicobs-room", "elsies-room", "garden"]) {
      expect(rooms.rooms.find((room) => room.id === roomId)?.lights).toEqual([]);
      expect(roomBindings.find((binding) => binding.roomId === roomId)?.lights).toEqual([]);
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
    expect(ids.some((id) => id.startsWith("cover."))).toBe(false);
    expect(ids).toContain("light.living_room_livingroom_light_2");
    expect(ids).toContain(homePageBindings.camera.entityId);
    expect(ids).toContain(
      cameraBindings.find((camera) => camera.cameraId === "back-garden")!.entityId,
    );
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
    expect(homePageBindings.activityEntityIds.length).toBeGreaterThan(0);
    expect(homePageBindings.activityEntityIds.every((entityId) => entityId !== "")).toBe(true);
    expect(new Set(homePageBindings.activityEntityIds).size).toBe(
      homePageBindings.activityEntityIds.length,
    );
    expect(roomIds.has(floorsPageBindings.kitchenRoomId)).toBe(true);
    expect(roomIds.has(floorsPageBindings.livingRoomId)).toBe(true);
    expect(roomIds.has(floorsPageBindings.hallwayRoomId)).toBe(true);
    expect(floorsPageBindings.bedroomRoomIds.every((roomId) => roomIds.has(roomId))).toBe(true);
  });

  it("uses the live Home Assistant entities with confident dashboard matches", () => {
    const kitchen = roomBindings.find((binding) => binding.roomId === "kitchen");
    const jaicobsRoom = roomBindings.find((binding) => binding.roomId === "jaicobs-room");

    expect(homePageBindings.houseTarget.entityId).toBe("input_number.heating_target_temperature");
    expect(homePageBindings.actions.goodNight.entityId).toBe("scene.night_time_mode");
    expect(homePageBindings.actions.movie).toEqual({
      domain: "input_boolean",
      service: "turn_on",
      entityId: "input_boolean.movie_mode",
    });
    expect(kitchen?.media).toBe("media_player.kitchen_pod");
    expect(kitchen?.motion).toBe("binary_sensor.kitchen_movement_occupancy");
    expect(jaicobsRoom?.media).toBe("media_player.jaicobs_xbox");
    expect(entryBindings.find((binding) => binding.entryId === "front-door")?.sensor).toBe(
      "binary_sensor.front_door_contact",
    );
    expect(entryBindings.find((binding) => binding.entryId === "back-door")?.sensor).toBe(
      "binary_sensor.back_door_contact",
    );
    expect(personBindings.find((binding) => binding.personId === "allister")?.entityId).toBe(
      "person.allister_antosik",
    );
    expect(securityPageBindings.alarmControlPanel.entityId).toBe(
      "alarm_control_panel.udm_se_colliery_lane_alarm_manager",
    );
  });
});
