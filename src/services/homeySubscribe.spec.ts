import { describe, expect, it } from "vitest";

import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { subscribeHomeyDevices } from "@/services/homeySubscribe";
import { TestDevice, TestHomey } from "@/services/homeyTestSupport";

describe("Homey activity history", () => {
  it("loads recent Insights entries for activity devices", async () => {
    const device = new TestDevice(homePageBindings.mediaPlayer.deviceId, {
      speaker_playing: true,
    });
    const homey = new TestHomey([device]);
    homey.insights = {
      getLogs: async () => ({
        "speaker-playing-log": {
          id: "speaker-playing-log",
          ownerId: device.id,
          ownerUri: "homey:device:test",
          title: "Speaker playing",
          titleTrue: "Started playing",
          titleFalse: "Stopped playing",
          type: "boolean",
          getEntries: async () => ({
            values: [{ t: "2026-10-18T10:00:00.000Z", v: true }],
          }),
        },
      }),
    };
    const received: string[] = [];

    const stop = await subscribeHomeyDevices(
      homey,
      () => {},
      (events) => received.push(...events.map((event) => event.text)),
    );

    expect(received).toEqual([`${device.name} started playing`]);
    stop();
  });

  it("continues when Insights access is unavailable", async () => {
    const homey = new TestHomey([]);
    homey.insights = { getLogs: async () => Promise.reject(new Error("Forbidden")) };
    const received: string[] = [];

    const stop = await subscribeHomeyDevices(
      homey,
      () => {},
      (events) => received.push(...events.map((event) => event.text)),
    );

    expect(received).toEqual([]);
    stop();
  });
});
