import { describe, expect, it } from "vitest";
import { demoRooms } from "@/data/demo/rooms";
import { demoSecurity } from "@/data/demo/security";
import { mapHomeyRooms } from "@/services/homeyRoomMapping";
import { mapHomeySecurity } from "@/services/homeySecurityMapping";
import type { RoomsState } from "@/models/rooms";

describe("Homey state mapping", () => {
  it("maps unavailable rooms without Pinia or changes to demo input", () => {
    const previous: RoomsState = {
      rooms: structuredClone(demoRooms),
      selectedRoomId: "living-room",
      mode: "demo",
      washingWeatherOk: false,
      outsideTempFromHomey: null,
      houseTempFromHomey: null,
      houseTargetFromHomey: null,
    };
    const before = structuredClone(previous);
    const next = mapHomeyRooms(previous, new Map());
    expect(previous).toEqual(before);
    expect(next.mode).toBe("live");
    expect(
      next.rooms.every((room) => room.temp === null && room.target === null && !room.media),
    ).toBe(true);
    expect(next.rooms.every((room) => room.deviceCount === 0)).toBe(true);
  });

  it("clears demonstration security readings without mutating the sample", () => {
    const previous = structuredClone(demoSecurity);
    const before = structuredClone(previous);
    const next = mapHomeySecurity(previous, new Map());
    expect(previous).toEqual(before);
    expect(next.mode).toBe("live");
    expect(next.alarmAvailable).toBe(false);
    expect(next.entries).toEqual([]);
    expect(next.cameras).toEqual([]);
    expect(next.people.every((person) => person.status === "UNAVAILABLE" && !person.home)).toBe(
      true,
    );
  });
});
