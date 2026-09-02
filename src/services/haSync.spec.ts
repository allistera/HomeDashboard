import type { HassEntities, HassEntity } from "home-assistant-js-websocket";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import {
  homePageBindings,
  roomBindingFor,
  securityPageBindings,
  washingBinding,
} from "@/services/haBindings";
import {
  applyEntities,
  blindClosedFrom,
  booleanPropertyFrom,
  cameraSnapshotUrlFrom,
  cameraStreamUrlFrom,
  lightLevelFrom,
  numericPropertyFrom,
  resetApplyEntitiesCache,
} from "@/services/haSync";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

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

  it("reads a numeric entity state or attribute", () => {
    const climate = entity("climate.house", "heat", {
      current_temperature: 20.7,
      temperature: "21.5",
    });
    expect(numericPropertyFrom(entity("sensor.house_temperature", "20.3"), "")).toBe(20.3);
    expect(numericPropertyFrom(climate, "current_temperature")).toBe(20.7);
    expect(numericPropertyFrom(climate, "temperature")).toBe(21.5);
    expect(numericPropertyFrom(climate, "missing")).toBeNull();
    expect(numericPropertyFrom(entity("sensor.unavailable", "unavailable"), "")).toBeNull();
  });

  it("reads a boolean property from an entity state or attribute", () => {
    expect(booleanPropertyFrom(entity("binary_sensor.drying", "on"), "")).toBe(true);
    expect(booleanPropertyFrom(entity("binary_sensor.drying", "off"), "")).toBe(false);
    expect(booleanPropertyFrom(entity("weather.home", "sunny", { dry: "True" }), "dry")).toBe(true);
    expect(booleanPropertyFrom(entity("weather.home", "sunny", { dry: "no" }), "dry")).toBe(false);
    expect(booleanPropertyFrom(undefined, "")).toBe(false);
  });

  it("builds camera snapshot and stream URLs from the per-camera access token", () => {
    const camera = entity("camera.front_door", "idle", { access_token: "token with spaces" });

    expect(cameraSnapshotUrlFrom("http://ha.local:8123/", camera)).toBe(
      "http://ha.local:8123/api/camera_proxy/camera.front_door?token=token%20with%20spaces",
    );
    expect(cameraStreamUrlFrom("http://ha.local:8123/", camera)).toBe(
      "http://ha.local:8123/api/camera_proxy_stream/camera.front_door?token=token%20with%20spaces",
    );
    expect(cameraSnapshotUrlFrom("", camera)).toBeNull();
    expect(cameraStreamUrlFrom("", camera)).toBeNull();
    expect(
      cameraStreamUrlFrom("http://ha.local:8123", entity("camera.front_door", "idle")),
    ).toBeNull();
  });
});

describe("applyEntities", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetApplyEntitiesCache();
  });

  it("maps bound light entities into the rooms store", () => {
    const rooms = useRoomsStore();
    const livingRoomBinding = roomBindingFor("living-room")!;
    applyEntities(
      asEntities([
        entity(livingRoomBinding.lights[0].entityId, "on", { brightness: 128 }),
        entity(livingRoomBinding.lights[1].entityId, "off"),
      ]),
    );

    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(livingRoom.lights.find((l) => l.id === livingRoomBinding.lights[0].lightId)!.level).toBe(
      50,
    );
    expect(livingRoom.lights.find((l) => l.id === livingRoomBinding.lights[1].lightId)!.level).toBe(
      0,
    );
  });

  it("maps configured house climate properties into dashboard values", () => {
    const rooms = useRoomsStore();

    applyEntities(
      asEntities([
        entity("sensor.outside_temperature", "8.4"),
        entity("sensor.house_temperature", "20.7"),
        entity("input_number.house_target_temperature", "21.5"),
      ]),
    );

    expect(rooms.outsideTemp).toBe(8.4);
    expect(rooms.houseTemp).toBe(20.7);
    expect(rooms.houseTarget).toBe(21.5);
  });

  it("falls back to room values when configured house properties are unavailable", () => {
    const rooms = useRoomsStore();

    applyEntities(
      asEntities([
        entity("sensor.outside_temperature", "unknown"),
        entity("sensor.house_temperature", "unavailable"),
        entity("input_number.house_target_temperature", "unknown"),
      ]),
    );

    expect(rooms.outsideTemp).toBe(12);
    expect(rooms.houseTemp).toBe(20.5);
    expect(rooms.houseTarget).toBe(21.5);
  });

  it("maps covers, climate, and media into a room", () => {
    const rooms = useRoomsStore();
    applyEntities(
      asEntities([
        entity("cover.living_room_south_window", "open", { current_position: 40 }),
        entity("climate.living_room", "heat", {
          current_temperature: 20.5,
          temperature: 22,
          preset_mode: "eco",
        }),
        entity("media_player.living_room", "playing", {
          media_title: "Night Jazz",
          friendly_name: "Apple TV",
        }),
        entity("media_player.apple_tv", "playing", {
          media_title: "Night Jazz",
          friendly_name: "Apple TV",
        }),
      ]),
    );

    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(livingRoom.blinds.find((b) => b.id === "south-window")!.closed).toBe(60);
    expect(livingRoom.temp).toBe(20.5);
    expect(livingRoom.target).toBe(22);
    expect(livingRoom.climateMode).toBe("Eco");
    expect(livingRoom.media!.playing).toBe(true);
    expect(livingRoom.media!.title).toBe("Night Jazz");
    expect(livingRoom.media!.output).toBe("Apple TV");
  });

  it("maps floor-page motion and vacuum bindings into room state", () => {
    const rooms = useRoomsStore();
    const hallwayBinding = roomBindingFor("hallway")!;
    const kitchenBinding = roomBindingFor("kitchen")!;

    applyEntities(
      asEntities([
        entity(hallwayBinding.motion!, "on"),
        entity(kitchenBinding.vacuum!, "cleaning"),
      ]),
    );

    const hallway = rooms.rooms.find((room) => room.id === "hallway")!;
    const kitchen = rooms.rooms.find((room) => room.id === "kitchen")!;
    expect(hallway.motion?.active).toBe(true);
    expect(hallway.motion?.lastChanged).toMatch(/\d/);
    expect(kitchen.vacuum?.state).toBe("Cleaning");
  });

  it("maps the configured alarm panel into security arm state", () => {
    const security = useSecurityStore();
    const alarm = securityPageBindings.alarmControlPanel;

    applyEntities(asEntities([entity(alarm.entityId, alarm.states.away)]));

    expect(security.armState).toBe("away");
    expect(security.secureSince).toMatch(/\d/);
  });

  it("maps the washing weather property into the drying reminder", () => {
    const rooms = useRoomsStore();
    expect(rooms.washingLabel).toBe("DO NOT PUT OUT THE WASHING");
    expect(rooms.washingTone).toBe("alert");

    applyEntities(asEntities([entity(washingBinding.entityId, "on")]));
    expect(rooms.washingWeatherOk).toBe(true);
    expect(rooms.washingLabel).toBe("PUT OUT THE WASHING");
    expect(rooms.washingTone).toBe("ok");

    resetApplyEntitiesCache();
    applyEntities(asEntities([entity(washingBinding.entityId, "off")]));
    expect(rooms.washingWeatherOk).toBe(false);
    expect(rooms.washingLabel).toBe("DO NOT PUT OUT THE WASHING");
    expect(rooms.washingTone).toBe("alert");
  });

  it("treats a missing washing entity as unsuitable weather", () => {
    const rooms = useRoomsStore();
    applyEntities(asEntities([entity("sensor.house_temperature", "20.5")]));
    expect(rooms.washingWeatherOk).toBe(false);
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

  it("maps available camera entities into snapshots and live proxy streams", () => {
    const security = useSecurityStore();
    const settings = useSettingsStore();
    settings.url = "http://ha.local:8123";

    applyEntities(
      asEntities([
        entity(homePageBindings.camera.entityId, "idle", { access_token: "front-token" }),
        entity("camera.driveway", "unavailable", { access_token: "drive-token" }),
      ]),
    );

    const encodedId = encodeURIComponent(homePageBindings.camera.entityId);
    const frontDoor = security.cameras.find((camera) => camera.id === "front-door")!;
    expect(frontDoor.live).toBe(true);
    expect(frontDoor.entityId).toBe(homePageBindings.camera.entityId);
    expect(frontDoor.note).toBeUndefined();
    expect(frontDoor.snapshotUrl).toBe(
      `http://ha.local:8123/api/camera_proxy/${encodedId}?token=front-token`,
    );
    expect(frontDoor.streamUrl).toBe(
      `http://ha.local:8123/api/camera_proxy_stream/${encodedId}?token=front-token`,
    );

    const driveway = security.cameras.find((camera) => camera.id === "driveway")!;
    expect(driveway.live).toBe(false);
    expect(driveway.entityId).toBe("camera.driveway");
    expect(driveway.snapshotUrl).toBeUndefined();
    expect(driveway.streamUrl).toBeUndefined();
    expect(driveway.note).toBe("STREAM UNAVAILABLE");
  });

  it("ignores unused media player attributes when applying entities", () => {
    const rooms = useRoomsStore();
    applyEntities(
      asEntities([
        entity("media_player.apple_tv", "playing", {
          media_title: "Night Jazz",
          media_position: 12,
        }),
      ]),
    );
    const livingRoom = rooms.rooms.find((r) => r.id === "living-room")!;
    expect(livingRoom.media!.title).toBe("Night Jazz");

    applyEntities(
      asEntities([
        entity("media_player.apple_tv", "playing", {
          media_title: "Night Jazz",
          media_position: 48,
        }),
      ]),
    );
    expect(livingRoom.media!.title).toBe("Night Jazz");
    expect(livingRoom.media!.playing).toBe(true);
  });

  it("leaves stores untouched for unknown or missing entities", () => {
    const rooms = useRoomsStore();
    const before = JSON.stringify(rooms.rooms);
    applyEntities(asEntities([entity("light.some_other_house", "on")]));
    expect(JSON.stringify(rooms.rooms)).toBe(before);
  });
});
