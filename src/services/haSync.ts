import type { HassEntities, HassEntity } from "home-assistant-js-websocket";

import {
  cameraBindings,
  entryBindings,
  homePageBindings,
  personBindings,
  roomBindings,
} from "@/services/haBindings";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

export function lightLevelFrom(entity: HassEntity): number {
  if (entity.state !== "on") return 0;
  const brightness = entity.attributes.brightness;
  return Number.isFinite(brightness) ? Math.round(Number(brightness) / 2.55) : 100;
}

// HA cover position is % open; the dashboard shows % closed.
export function blindClosedFrom(entity: HassEntity): number {
  const position = entity.attributes.current_position;
  if (Number.isFinite(position)) return 100 - Number(position);
  return entity.state === "open" ? 0 : 100;
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

export function cameraStreamUrlFrom(baseUrl: string, entity: HassEntity): string | null {
  const accessToken = String(entity.attributes.access_token ?? "").trim();
  if (baseUrl === "" || accessToken === "") return null;

  const root = baseUrl.replace(/\/+$/, "");
  const entityId = encodeURIComponent(entity.entity_id);
  const token = encodeURIComponent(accessToken);
  return `${root}/api/camera_proxy_stream/${entityId}?token=${token}`;
}

function timeOf(entity: HassEntity): string {
  return new Date(entity.last_changed).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function applyEntities(entities: HassEntities): void {
  const rooms = useRoomsStore();
  const security = useSecurityStore();
  const settings = useSettingsStore();

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

  for (const binding of roomBindings) {
    const room = rooms.rooms.find((r) => r.id === binding.roomId);
    if (!room) continue;

    for (const lightBinding of binding.lights) {
      const entity = entities[lightBinding.entityId];
      const light = room.lights.find((l) => l.id === lightBinding.lightId);
      if (entity && light) light.level = lightLevelFrom(entity);
    }

    for (const coverBinding of binding.covers) {
      const entity = entities[coverBinding.entityId];
      const blind = room.blinds.find((b) => b.id === coverBinding.blindId);
      if (entity && blind) blind.closed = blindClosedFrom(entity);
    }

    if (binding.climate) {
      const entity = entities[binding.climate];
      if (entity) {
        const current = entity.attributes.current_temperature;
        const target = entity.attributes.temperature;
        if (Number.isFinite(current)) room.temp = Number(current);
        if (Number.isFinite(target)) room.target = Number(target);
      }
    }

    if (binding.media && room.media) {
      const entity = entities[binding.media];
      if (entity) {
        room.media.playing = entity.state === "playing";
        const title = entity.attributes.media_title;
        if (title) room.media.title = String(title);
        const output = entity.attributes.source ?? entity.attributes.friendly_name;
        if (output) room.media.output = String(output);
      }
    }
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
    if (!entity) {
      camera.live = false;
      camera.streamUrl = undefined;
      camera.note = "STREAM UNAVAILABLE";
      continue;
    }

    const available = !["off", "unavailable", "unknown"].includes(entity.state);
    const streamUrl = available ? cameraStreamUrlFrom(settings.url, entity) : null;
    camera.live = streamUrl !== null;
    camera.streamUrl = streamUrl ?? undefined;
    camera.note = camera.live ? undefined : "STREAM UNAVAILABLE";
  }
}
