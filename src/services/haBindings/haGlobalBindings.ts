import { homePageBindings } from "@/services/haBindings/haHomeBindings";
import { roomBindings } from "@/services/haBindings/haRoomsBindings";
import {
  cameraBindings,
  entryBindings,
  personBindings,
  securityPageBindings,
} from "@/services/haBindings/haSecurityBindings";

export interface LightBinding {
  lightId: string;
  entityId: string;
}

export interface CoverBinding {
  blindId: string;
  entityId: string;
}

export interface RoomBinding {
  roomId: string;
  lights: LightBinding[];
  covers: CoverBinding[];
  climate?: string;
  // Standalone sensor holding the room temperature, for rooms without a
  // climate entity or where the sensor reads truer than the thermostat.
  // Takes precedence over the climate entity's current temperature.
  temperature?: EntityPropertyBinding;
  media?: string;
  motion?: string;
  vacuum?: string;
}

export interface EntryBinding {
  entryId: string;
  lock?: string;
  sensor?: string;
}

export interface PersonBinding {
  personId: string;
  entityId: string;
}

export interface CameraBinding {
  cameraId: string;
  entityId: string;
}

export interface EntityPropertyBinding {
  entityId: string;
  attribute: string;
}

export interface MediaPlayerBinding {
  roomId: string;
  entityId: string;
}

export interface EntityActionBinding {
  domain: string;
  service: string;
  entityId: string;
}

export type AlarmArmState = "home" | "away" | "disarmed";

export interface AlarmControlPanelBinding {
  entityId: string;
  states: Record<AlarmArmState, string>;
  services: Record<AlarmArmState, string>;
}

// Home Assistant attributes consumed by more than one page.
export const entityProperties = {
  lightBrightness: "brightness",
  coverPosition: "current_position",
  climateCurrentTemperature: "current_temperature",
  climateTargetTemperature: "temperature",
  climatePreset: "preset_mode",
  mediaTitle: "media_title",
  mediaOutput: ["source", "friendly_name"],
  cameraAccessToken: "access_token",
} as const;

export const activeMediaPlayerStates: ReadonlySet<string> = new Set([
  "on",
  "idle",
  "playing",
  "paused",
  "buffering",
]);

// Drying weather is rendered in the shared top bar across multiple pages.
// `attribute: ""` reads the entity state itself.
export const washingBinding: EntityPropertyBinding = {
  entityId: "binary_sensor.good_drying_weather",
  attribute: "",
};

function addEntityId(ids: Set<string>, entityId: string | undefined): void {
  if (entityId) ids.add(entityId);
}

// Entity IDs whose state this dashboard actually reads. Bindings are static
// config, so the combined subscription list is computed once and reused.
let watchedIdsCache: string[] | null = null;

export function watchedEntityIds(): string[] {
  if (watchedIdsCache !== null) return watchedIdsCache;

  const ids = new Set<string>();
  addEntityId(ids, homePageBindings.outsideTemperature.entityId);
  addEntityId(ids, homePageBindings.houseTemperature.entityId);
  addEntityId(ids, homePageBindings.houseTarget.entityId);
  addEntityId(ids, securityPageBindings.alarmControlPanel.entityId);
  addEntityId(ids, washingBinding.entityId);

  for (const room of roomBindings) {
    for (const light of room.lights) addEntityId(ids, light.entityId);
    for (const cover of room.covers) addEntityId(ids, cover.entityId);
    addEntityId(ids, room.climate);
    addEntityId(ids, room.temperature?.entityId);
    addEntityId(ids, room.media);
    addEntityId(ids, room.motion);
    addEntityId(ids, room.vacuum);
  }

  for (const entry of entryBindings) {
    addEntityId(ids, entry.lock);
    addEntityId(ids, entry.sensor);
  }

  for (const person of personBindings) addEntityId(ids, person.entityId);
  for (const camera of cameraBindings) addEntityId(ids, camera.entityId);

  watchedIdsCache = [...ids];
  return watchedIdsCache;
}
