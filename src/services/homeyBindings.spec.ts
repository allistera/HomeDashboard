import { describe, expect, it } from "vitest";
import { watchedDeviceIds } from "@/services/homeyBindings/homeyGlobalBindings";
import { livingRoomMediaBinding, roomBindings } from "@/services/homeyBindings/homeyRoomsBindings";
import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import {
  cameraBindings,
  securityPageBindings,
} from "@/services/homeyBindings/homeySecurityBindings";

describe("Homey device bindings", () => {
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
