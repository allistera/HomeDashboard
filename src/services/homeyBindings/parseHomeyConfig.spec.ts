import { describe, expect, it } from "vitest";
import source from "@/config/homey.yaml?raw";
import { parseHomeyConfig } from "@/services/homeyBindings/parseHomeyConfig";

describe("Homey configuration decoding", () => {
  it("resolves YAML aliases into validated bindings", () => {
    const config = parseHomeyConfig(source);
    expect(config.home.mediaPlayer.deviceId).toBe(config.rooms[0].media);
    expect(config.rooms[0].lights[0].deviceId).toBe(config.home.activityDeviceIds[4]);
  });

  it.each([
    [source.replace("sensorCount: 2", 'sensorCount: "two"'), "config.security.sensorCount"],
    [source.replace("lights: []", "lights: null"), "config.rooms[1].lights"],
    [
      source.replace("capabilityId: alarm_motion", "capabilityId: 42"),
      "config.rooms[0].motion.capabilityId",
    ],
    [source.replace("outsideTemperatureTokenId:", "outsideTemperatureTokenTypo:"), "config.home"],
    [source.replace("kitchenRoomId: kitchen", "kitchenRoomId: missing"), "mapped room ID"],
    [source.replace("- roomId: kitchen", "- roomId: living-room"), "unique room IDs"],
    [
      source.replace("camera: { cameraId: front-door }", "camera: { cameraId: missing }"),
      "config.home.camera.cameraId",
    ],
    ["home: [", "Invalid homey.yaml"],
  ])("rejects invalid configuration with a useful location", (input, location) => {
    expect(() => parseHomeyConfig(input)).toThrow(location);
  });
});
