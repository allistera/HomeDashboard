import type { HassEntityState, HassEntityStates } from "home-assistant-js-websocket";

import {
  entryBindings,
  homePageBindings,
  roomBindingFor,
  roomBindings,
  roomEntityIds,
  securityPageBindings,
  type EntityProperty,
} from "@/config/homeAssistant";
import type { HueSaturation, LightColour, Room, RoomDevice } from "@/models/rooms";
import type { Camera, Entry } from "@/models/security";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";
import { hueSaturationHex, rgbHex, rgbHueSaturation } from "@/utils/lightColour";

const colourModes = new Set(["hs", "xy", "rgb", "rgbw", "rgbww"]);

export function available(entity: HassEntityState | undefined): entity is HassEntityState {
  return !!entity && entity.state !== "unknown" && entity.state !== "unavailable";
}

function numeric(value: string | number | null | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const reading = Number(value);
  return Number.isFinite(reading) ? reading : null;
}

function reading(entities: HassEntityStates, binding?: EntityProperty): number | null {
  const entity = binding && entities[binding.entityId];
  if (!available(entity)) return null;
  return numeric(binding?.attribute ? entity.attributes[binding.attribute] : entity.state);
}

function entityName(entity: HassEntityState): string {
  return entity.attributes.friendly_name ?? entity.entity_id.split(".")[1].replaceAll("_", " ");
}

function cameraSnapshot(entity: HassEntityState, baseUrl: string): string | undefined {
  const token = entity.attributes.access_token;
  if (!baseUrl || !token) return undefined;
  return `${baseUrl}/api/camera_proxy/${encodeURIComponent(entity.entity_id)}?token=${encodeURIComponent(token)}`;
}

function roomDevice(entity: HassEntityState, name = entityName(entity)): RoomDevice {
  return {
    id: entity.entity_id,
    name,
    type: entity.entity_id.split(".")[0],
    available: available(entity),
    properties: [
      {
        id: "state",
        name: "State",
        value: entity.state,
        units: entity.attributes.unit_of_measurement,
      },
      ...[
        "brightness",
        "current_temperature",
        "temperature",
        "humidity",
        "battery_level",
        "preset_mode",
        "media_title",
        "source",
        "device_class",
      ].flatMap((id) => {
        const value = entity.attributes[id];
        return value == null ? [] : [{ id, name: id.replaceAll("_", " "), value }];
      }),
    ],
  };
}

function lightColour(entity: HassEntityState, previous?: LightColour): LightColour | undefined {
  const attrs = entity.attributes;
  const modes = Array.isArray(attrs.supported_color_modes) ? attrs.supported_color_modes : [];
  const supportsColour = modes.some((mode) => colourModes.has(mode));
  const fixedWhite = modes.includes("white");
  const temperature = modes.includes("color_temp")
    ? {
        min: numeric(attrs.min_color_temp_kelvin) ?? 2000,
        max: numeric(attrs.max_color_temp_kelvin) ?? 6535,
      }
    : undefined;
  if (!supportsColour && !temperature && !fixedWhite) return undefined;

  const reportedHs = Array.isArray(attrs.hs_color) ? attrs.hs_color : [];
  const hue = numeric(reportedHs[0]);
  const saturation = numeric(reportedHs[1]);
  const kelvin = temperature ? (numeric(attrs.color_temp_kelvin) ?? undefined) : undefined;
  const rgb = Array.isArray(attrs.rgb_color) ? attrs.rgb_color : [];
  const validRgb =
    rgb.length === 3 && rgb.every((value) => Number.isFinite(value) && value >= 0 && value <= 255);
  let hs: HueSaturation | undefined;
  if (supportsColour && hue !== null && saturation !== null) {
    hs = [hue, saturation];
  } else if (supportsColour && validRgb) {
    hs = rgbHueSaturation(rgb[0], rgb[1], rgb[2]);
  }

  const swatch = validRgb
    ? rgbHex(rgb[0], rgb[1], rgb[2])
    : hs
      ? hueSaturationHex(hs)
      : attrs.color_mode === "white"
        ? "#FFFFFF"
        : undefined;

  // Most lights omit their colour attributes while off.
  const last = entity.state === "off" ? previous : undefined;
  return {
    supportsColour,
    temperature,
    fixedWhite,
    hs: hs ?? last?.hs,
    kelvin: kelvin ?? last?.kelvin,
    swatch: swatch ?? last?.swatch,
  };
}

function syncRoom(
  room: Room,
  roomEntities: HassEntityState[],
  entities: HassEntityStates,
  baseUrl: string,
): void {
  const binding = roomBindingFor(room.id);
  room.devices = [...new Set(binding?.deviceAllowlist)]
    .flatMap((id) => {
      const entity = entities[id];
      return entity ? [roomDevice(entity, binding?.deviceNames?.[id])] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  room.activityEntityIds = roomEntities.map((entity) => entity.entity_id);
  room.deviceCount = room.devices.length;
  room.offlineCount = room.devices.filter((device) => !device.available).length;
  const camera = roomEntities.find((entity) => entity.entity_id.startsWith("camera."));
  room.camera = camera
    ? {
        id: camera.entity_id,
        name: entityName(camera),
        available: available(camera) && camera.state !== "off",
        snapshotUrl: cameraSnapshot(camera, baseUrl),
      }
    : undefined;
  room.lights = (binding?.lights ?? []).flatMap((light) => {
    const entity = entities[light.entityId];
    if (!available(entity)) return [];
    const modes = entity.attributes.supported_color_modes;
    const dimmable =
      Array.isArray(modes) && modes.some((mode) => mode !== "onoff" && mode !== "unknown");
    const brightness = numeric(entity.attributes.brightness);
    return [
      {
        id: light.lightId,
        name: entityName(entity).trim(),
        dimmable,
        colour: lightColour(
          entity,
          room.lights.find((previous) => previous.id === light.lightId)?.colour,
        ),
        level:
          entity.state === "on" ? (brightness === null ? 100 : Math.round(brightness / 2.55)) : 0,
      },
    ];
  });
  const climate = binding?.climate && entities[binding.climate];
  room.temp =
    reading(entities, binding?.temperature) ??
    (available(climate) ? numeric(climate.attributes.current_temperature) : null);
  room.target = available(climate) ? numeric(climate.attributes.temperature) : null;
  room.climateMode = available(climate)
    ? (climate.attributes.preset_mode ?? climate.state)
    : undefined;
  const media = binding?.media && entities[binding.media];
  room.media = available(media)
    ? {
        title: media.attributes.media_title ?? "Nothing playing",
        output: media.attributes.source ?? entityName(media),
        playing: media.state === "playing",
        active: ["playing", "paused", "buffering", "on", "idle"].includes(media.state),
      }
    : undefined;
  const motion = binding?.motion && entities[binding.motion];
  room.motion = available(motion)
    ? {
        active: motion.state === "on",
        lastChanged: formatTime(motion.last_changed),
        lastChangedAt: Date.parse(motion.last_changed),
      }
    : undefined;
  const vacuum = binding?.vacuum && entities[binding.vacuum];
  room.vacuum = available(vacuum) ? { state: vacuum.state } : undefined;
  room.meta = "";
  room.events = [];
}

function formatTime(time: string): string {
  return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function entriesFrom(entities: HassEntityStates): Entry[] {
  return entryBindings.map((binding) => {
    const contact = binding.sensor && entities[binding.sensor];
    const lock = binding.lock && entities[binding.lock];
    const contactKnown = available(contact) && ["on", "off"].includes(contact.state);
    const lockKnown = available(lock) && ["locked", "unlocked"].includes(lock.state);
    const open = contactKnown && contact.state === "on";
    const locked = lockKnown && lock.state === "locked";
    return {
      id: binding.entryId,
      name: contact
        ? entityName(contact).replace(/ contact$/i, "")
        : binding.entryId.replaceAll("-", " "),
      kind: "door",
      open,
      locked,
      lockAvailable: lockKnown,
      statusKnown: contactKnown || lockKnown,
      detail: open
        ? "OPEN"
        : lockKnown
          ? locked
            ? "LOCKED"
            : "UNLOCKED"
          : contactKnown
            ? "CLOSED"
            : "UNAVAILABLE",
    };
  });
}

function camerasFrom(entities: HassEntityStates, baseUrl: string): Camera[] {
  return Object.values(entities)
    .filter((entity) => entity.entity_id.startsWith("camera."))
    .map((entity) => {
      const online = available(entity) && entity.state !== "off";
      const frontDoor = entity.entity_id === securityPageBindings.frontDoorCamera;
      return {
        id: frontDoor ? "front-door" : entity.entity_id,
        entityId: entity.entity_id,
        name: frontDoor ? "Front door" : entityName(entity),
        available: online,
        live: online,
        snapshotUrl: online ? cameraSnapshot(entity, baseUrl) : undefined,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function applyEntities(entities: HassEntityStates, areas = new Map<string, string>()): void {
  const rooms = useRoomsStore();
  const security = useSecurityStore();
  const baseUrl = useSettingsStore().url;
  rooms.mode = "live";
  const washingBinding = homePageBindings.washingWeather;
  const washing = washingBinding && entities[washingBinding.entityId];
  rooms.washingWeatherOk = available(washing)
    ? (washingBinding?.attribute ? washing.attributes[washingBinding.attribute] : washing.state) ===
      "on"
    : null;
  rooms.setHomeClimateValues(
    reading(entities, homePageBindings.outsideTemperature),
    reading(entities, homePageBindings.houseTemperature),
    reading(entities, homePageBindings.houseTarget),
  );
  for (const binding of roomBindings) {
    if (!binding.name || rooms.rooms.some((room) => room.id === binding.roomId)) continue;
    rooms.rooms.push({
      id: binding.roomId,
      name: binding.name,
      floor: binding.floor ?? "",
      lights: [],
      temp: null,
      target: null,
      meta: "",
      events: [],
      deviceCount: 0,
      offlineCount: 0,
    });
  }
  const currentStates = Object.values(entities);
  for (const room of rooms.rooms) {
    const binding = roomBindingFor(room.id);
    const explicit = new Set(roomEntityIds(room.id));
    const roomEntities = currentStates.filter(
      (entity) =>
        explicit.has(entity.entity_id) ||
        binding?.areas.includes(areas.get(entity.entity_id) ?? ""),
    );
    syncRoom(room, roomEntities, entities, baseUrl);
  }

  security.mode = "live";
  security.entries = entriesFrom(entities);
  security.cameras = camerasFrom(entities, baseUrl);
  security.events = [];
  const alarm = entities[securityPageBindings.alarmControlPanel];
  const states = { armed_home: "home", armed_away: "away", disarmed: "disarmed" } as const;
  security.alarmAvailable =
    available(alarm) &&
    (alarm.state === "armed_home" || alarm.state === "armed_away" || alarm.state === "disarmed");
  if (security.alarmAvailable) {
    const armState = Object.entries(states).find(([state]) => alarm.state === state)?.[1];
    if (armState) security.setArmStateFromHa(armState, formatTime(alarm.last_changed));
  }
  security.people = securityPageBindings.people.flatMap((id) => {
    const entity = entities[id];
    if (!entity) return [];
    const home = available(entity) ? entity.state === "home" : undefined;
    return [
      {
        id,
        name: entityName(entity),
        home,
        status: home === undefined ? "UNAVAILABLE" : home ? "HOME" : "AWAY",
        color: "#C7CEEC",
      },
    ];
  });
}
