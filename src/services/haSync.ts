import type { HassEntities, HassEntity } from "home-assistant-js-websocket";

import {
  activeMediaPlayerStates,
  entityProperties,
  washingBinding,
  watchedEntityIds,
  type AlarmArmState,
} from "@/services/haBindings/haGlobalBindings";
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
import { useSettingsStore } from "@/stores/settings";

const alarmArmStates = ["home", "away", "disarmed"] satisfies AlarmArmState[];

export function lightLevelFrom(entity: HassEntity): number {
  if (entity.state !== "on") return 0;
  const brightness = entity.attributes[entityProperties.lightBrightness];
  return Number.isFinite(brightness) ? Math.round(Number(brightness) / 2.55) : 100;
}

export function numericPropertyFrom(
  entity: HassEntity | undefined,
  attribute: string,
): number | null {
  if (!entity) return null;
  const value = attribute === "" ? entity.state : entity.attributes[attribute];
  const serialized = String(value ?? "").trim();
  if (serialized === "") return null;
  const number = Number(serialized);
  return Number.isFinite(number) ? number : null;
}

// Home Assistant states that read as "yes" for a boolean-ish property.
const truthyStates = ["on", "true", "yes", "1"];

export function booleanPropertyFrom(entity: HassEntity | undefined, attribute: string): boolean {
  if (!entity) return false;
  const value = attribute === "" ? entity.state : entity.attributes[attribute];
  return truthyStates.includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

const consumedAttributes = [
  entityProperties.lightBrightness,
  entityProperties.climateCurrentTemperature,
  entityProperties.climateTargetTemperature,
  entityProperties.climatePreset,
  entityProperties.mediaTitle,
  ...entityProperties.mediaOutput,
  entityProperties.cameraAccessToken,
  // An empty attribute means "read the state itself", so nothing to consume.
  ...(washingBinding.attribute === "" ? [] : [washingBinding.attribute]),
  ...roomBindings.flatMap((room) =>
    room.temperature && room.temperature.attribute !== "" ? [room.temperature.attribute] : [],
  ),
] as const;

let lastApplyKey = "";

export function resetApplyEntitiesCache(): void {
  lastApplyKey = "";
}

function entityApplyKey(entity: HassEntity | undefined): string {
  if (!entity) return "";
  const parts = [entity.state, entity.last_changed];
  for (const attribute of consumedAttributes) {
    parts.push(String(entity.attributes[attribute] ?? ""));
  }
  return parts.join("\0");
}

function cameraProxyUrlFrom(
  baseUrl: string,
  entity: HassEntity,
  endpoint: "camera_proxy" | "camera_proxy_stream",
): string | null {
  const accessToken = String(entity.attributes[entityProperties.cameraAccessToken] ?? "").trim();
  if (baseUrl === "" || accessToken === "") return null;

  const root = baseUrl.replace(/\/+$/, "");
  const entityId = encodeURIComponent(entity.entity_id);
  const token = encodeURIComponent(accessToken);
  return `${root}/api/${endpoint}/${entityId}?token=${token}`;
}

export function cameraSnapshotUrlFrom(baseUrl: string, entity: HassEntity): string | null {
  return cameraProxyUrlFrom(baseUrl, entity, "camera_proxy");
}

export function cameraStreamUrlFrom(baseUrl: string, entity: HassEntity): string | null {
  return cameraProxyUrlFrom(baseUrl, entity, "camera_proxy_stream");
}

function timeOf(entity: HassEntity): string {
  return new Date(entity.last_changed).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function stateLabel(state: string): string {
  return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function applyEntities(entities: HassEntities): void {
  const rooms = useRoomsStore();
  const security = useSecurityStore();
  const settings = useSettingsStore();
  const applyKey = `${settings.url}\n${watchedEntityIds()
    .map((id) => `${id}:${entityApplyKey(entities[id])}`)
    .join("|")}`;
  if (applyKey === lastApplyKey) return;
  lastApplyKey = applyKey;

  rooms.setHomeClimateValues(
    numericPropertyFrom(
      entities[homePageBindings.outsideTemperature.entityId],
      homePageBindings.outsideTemperature.attribute,
    ),
    numericPropertyFrom(
      entities[homePageBindings.houseTemperature.entityId],
      homePageBindings.houseTemperature.attribute,
    ),
    numericPropertyFrom(
      entities[homePageBindings.houseTarget.entityId],
      homePageBindings.houseTarget.attribute,
    ),
  );

  rooms.setWashingWeather(
    booleanPropertyFrom(entities[washingBinding.entityId], washingBinding.attribute),
  );

  for (const binding of roomBindings) {
    const room = rooms.rooms.find((r) => r.id === binding.roomId);
    if (!room) continue;

    for (const lightBinding of binding.lights) {
      const entity = entities[lightBinding.entityId];
      const light = room.lights.find((l) => l.id === lightBinding.lightId);
      if (entity && light) light.level = lightLevelFrom(entity);
    }

    if (binding.climate) {
      const entity = entities[binding.climate];
      if (entity) {
        const current = entity.attributes[entityProperties.climateCurrentTemperature];
        const target = entity.attributes[entityProperties.climateTargetTemperature];
        const preset = entity.attributes[entityProperties.climatePreset];
        if (Number.isFinite(current)) room.temp = Number(current);
        if (Number.isFinite(target)) room.target = Number(target);
        if (preset) room.climateMode = stateLabel(String(preset));
      }
    }

    if (binding.temperature) {
      const temperature = numericPropertyFrom(
        entities[binding.temperature.entityId],
        binding.temperature.attribute,
      );
      if (temperature !== null) room.temp = temperature;
    }

    if (binding.media && room.media) {
      const entity = entities[binding.media];
      if (entity) {
        room.media.playing = entity.state === "playing";
        room.media.active = activeMediaPlayerStates.has(entity.state);
        const title = entity.attributes[entityProperties.mediaTitle];
        if (title) room.media.title = String(title);
        const output = entityProperties.mediaOutput
          .map((attribute) => entity.attributes[attribute])
          .find(Boolean);
        if (output) room.media.output = String(output);
      }
    }

    if (binding.motion && room.motion) {
      const entity = entities[binding.motion];
      if (entity) {
        room.motion.active = entity.state === "on";
        room.motion.lastChanged = timeOf(entity);
        const lastChangedAt = Date.parse(entity.last_changed);
        if (Number.isFinite(lastChangedAt)) room.motion.lastChangedAt = lastChangedAt;
      }
    }

    if (binding.vacuum && room.vacuum) {
      const entity = entities[binding.vacuum];
      if (entity) room.vacuum.state = stateLabel(entity.state);
    }
  }

  const alarmBinding = securityPageBindings.alarmControlPanel;
  const alarmEntity = entities[alarmBinding.entityId];
  if (alarmEntity) {
    const armState = alarmArmStates.find(
      (state) => alarmBinding.states[state] === alarmEntity.state,
    );
    if (armState) security.setArmStateFromHa(armState, timeOf(alarmEntity));
  }

  for (const binding of entryBindings) {
    const entry = security.entries.find((e) => e.id === binding.entryId);
    if (!entry) continue;

    const lock = binding.lock ? entities[binding.lock] : undefined;
    const sensor = binding.sensor ? entities[binding.sensor] : undefined;
    if (lock) entry.locked = lock.state === "locked";
    if (sensor) entry.open = sensor.state === "on";
    if (entry.open && sensor) {
      entry.detail = `OPEN · ${timeOf(sensor)}`;
    } else if (lock) {
      entry.detail = `${entry.locked ? "LOCKED" : "UNLOCKED"} · ${timeOf(lock)}`;
    } else if (sensor) {
      entry.detail = `CLOSED · ${timeOf(sensor)}`;
    }
  }

  for (const binding of personBindings) {
    const person = security.people.find((p) => p.id === binding.personId);
    const entity = entities[binding.entityId];
    if (!person || !entity) continue;
    person.home = entity.state === "home";
    person.status = person.home ? `ARRIVED ${timeOf(entity)}` : "AWAY";
  }

  for (const binding of cameraBindings) {
    const camera = security.cameras.find((item) => item.id === binding.cameraId);
    const entity = entities[binding.entityId];
    if (!camera) continue;
    camera.entityId = binding.entityId;
    if (!entity) {
      camera.live = false;
      camera.snapshotUrl = undefined;
      camera.streamUrl = undefined;
      camera.note = "STREAM UNAVAILABLE";
      continue;
    }

    const available = !["off", "unavailable", "unknown"].includes(entity.state);
    const snapshotUrl = available ? cameraSnapshotUrlFrom(settings.url, entity) : null;
    const streamUrl = available ? cameraStreamUrlFrom(settings.url, entity) : null;
    camera.live = snapshotUrl !== null;
    camera.snapshotUrl = snapshotUrl ?? undefined;
    camera.streamUrl = streamUrl ?? undefined;
    camera.note = camera.live ? undefined : "STREAM UNAVAILABLE";
  }
}
