import type { HassEntities, HassEntity } from "home-assistant-js-websocket";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { applyEntities, blindClosedFrom, lightLevelFrom } from "@/services/haSync";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

function entity(
  entityId: string,
  state: string,
  attributes: Record<string, number | string> = {},
): HassEntity {
  return {
    entity_id: entityId,
    state,
    last_changed: "2026-08-17T18:42:00Z",
    last_updated: "2026-08-17T18:42:00Z",
    attributes,
    context: { id: "test", user_id: null, parent_id: null },
  };
}

function asEntities(list: HassEntity[]): HassEntities {
  const entities: HassEntities = {};
  for (const item of list) entities[item.entity_id] = item;
  return entities;
}

describe("entity conversion", () => {
  it("converts light brightness to a percentage level", () => {
    expect(lightLevelFrom(entity("light.x", "on", { brightness: 128 }))).toBe(50);
    expect(lightLevelFrom(entity("light.x", "on"))).toBe(100);
    expect(lightLevelFrom(entity("light.x", "off", { brightness: 128 }))).toBe(0);
  });

  it("converts cover position (% open) to blind closed %", () => {
    expect(blindClosedFrom(entity("cover.x", "open", { current_position: 25 }))).toBe(75);
    expect(blindClosedFrom(entity("cover.x", "open"))).toBe(0);
    expect(blindClosedFrom(entity("cover.x", "closed"))).toBe(100);
  });
});

describe("applyEntities", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("maps bound light entities into the rooms store", () => {
    const rooms = useRoomsStore();
    applyEntities(
      asEntities([
        entity("light.living_room_ceiling", "on", { brightness: 128 }),
        entity("light.living_room_floor_lamp", "off"),
      ]),
    );

    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(livingRoom.lights.find((l) => l.id === "ceiling")!.level).toBe(50);
    expect(livingRoom.lights.find((l) => l.id === "floor-lamp")!.level).toBe(0);
  });

  it("maps covers, climate, and media into a room", () => {
    const rooms = useRoomsStore();
    applyEntities(
      asEntities([
        entity("cover.living_room_south_window", "open", { current_position: 40 }),
        entity("climate.living_room", "heat", { current_temperature: 20.5, temperature: 22 }),
        entity("media_player.living_room", "playing", { media_title: "Night Jazz" }),
      ]),
    );

    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(livingRoom.blinds.find((b) => b.id === "south-window")!.closed).toBe(60);
    expect(livingRoom.temp).toBe(20.5);
    expect(livingRoom.target).toBe(22);
    expect(livingRoom.media!.playing).toBe(true);
    expect(livingRoom.media!.title).toBe("Night Jazz");
  });

  it("maps locks and door/window sensors into security entries", () => {
    const security = useSecurityStore();
    applyEntities(
      asEntities([
        entity("lock.front_door", "unlocked"),
        entity("binary_sensor.front_door", "on"),
        entity("binary_sensor.jaicobs_room_window", "off"),
      ]),
    );

    const frontDoor = security.entries.find((e) => e.id === "front-door")!;
    expect(frontDoor.locked).toBe(false);
    expect(frontDoor.open).toBe(true);
    expect(frontDoor.detail).toMatch(/^OPEN · /);

    const window = security.entries.find((e) => e.id === "jaicobs-room-window")!;
    expect(window.open).toBe(false);
    expect(window.detail).toMatch(/^CLOSED · /);
  });

  it("maps person entities into presence", () => {
    const security = useSecurityStore();
    applyEntities(
      asEntities([entity("person.jaicob", "not_home"), entity("person.elsie", "home")]),
    );

    const jaicob = security.people.find((p) => p.id === "jaicob")!;
    expect(jaicob.home).toBe(false);
    expect(jaicob.status).toBe("AWAY");

    const elsie = security.people.find((p) => p.id === "elsie")!;
    expect(elsie.home).toBe(true);
    expect(elsie.status).toMatch(/^ARRIVED /);

    expect(security.peopleHome).toBe(3);
  });

  it("leaves stores untouched for unknown or missing entities", () => {
    const rooms = useRoomsStore();
    const before = JSON.stringify(rooms.rooms);
    applyEntities(asEntities([entity("light.some_other_house", "on")]));
    expect(JSON.stringify(rooms.rooms)).toBe(before);
  });
});
