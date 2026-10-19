import { describe, expect, it } from "vitest";
import { homeyConfig } from "@/services/homeyBindings/homeyConfig";
import { watchedDeviceIds } from "@/services/homeyBindings/homeyGlobalBindings";
import { livingRoomMediaBinding, roomBindings } from "@/services/homeyBindings/homeyRoomsBindings";
import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import {
  cameraBindings,
  securityPageBindings,
} from "@/services/homeyBindings/homeySecurityBindings";

describe("Homey device bindings", () => {
  it("resolves shared screen mappings from the central YAML", () => {
    expect(homePageBindings).toBe(homeyConfig.home);
    expect(roomBindings).toBe(homeyConfig.rooms);
    expect(cameraBindings).toBe(homeyConfig.security.cameras);
    const roomIds = roomBindings.map((room) => room.roomId);
    expect(new Set(roomIds).size).toBe(roomIds.length);
    for (const roomId of Object.values(homeyConfig.floors).flat()) {
      expect(roomIds).toContain(roomId);
    }
    for (const roomId of Object.keys(homePageBindings.roomZoneIds)) {
      expect(roomIds).toContain(roomId);
    }
    expect(
      cameraBindings.some((camera) => camera.cameraId === homePageBindings.camera.cameraId),
    ).toBe(true);
    const mediaRoom = roomBindings.find(
      (room) => room.roomId === homePageBindings.mediaPlayer.roomId,
    );
    expect(mediaRoom?.media).toBe(homePageBindings.mediaPlayer.deviceId);
    for (const id of homePageBindings.activityDeviceIds) expect(watchedDeviceIds()).toContain(id);
  });

  it("uses only verified device UUIDs and keeps missing hardware unbound", () => {
    const ids = watchedDeviceIds();
    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    expect(ids).toContain(livingRoomMediaBinding.deviceId);
    expect(cameraBindings).toContainEqual({
      cameraId: "front-door",
      deviceId: "0c7f09c5-98ea-4cf2-ac1c-804acbbb9abc",
    });
    expect(
      roomBindings
        .filter((room) => !["living-room", "hallway", "toilet", "bedroom"].includes(room.roomId))
        .every((room) => room.lights.length === 0),
    ).toBe(true);
    expect(homePageBindings.outsideTemperature).toBeUndefined();
    expect(homePageBindings.houseTarget).toBeUndefined();
    expect(securityPageBindings.alarmControlPanel).toBeUndefined();
  });
});
