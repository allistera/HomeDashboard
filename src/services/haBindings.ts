// Maps dashboard concepts to Home Assistant entity IDs. This is the single
// file to edit when your HA instance uses different entity names — nothing
// else in the app refers to entity IDs.

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

// Home Assistant attributes consumed by rendered page elements. Keeping these
// here makes both entity IDs and property names configurable at one seam.
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

// Home-page entity selections live here. Display copy and other presentation-only
// values stay in HomePage; room lights, entries and people use the bindings below.
export const homePageBindings = {
  outsideTemperature: {
    entityId: "sensor.outside_temperature",
    attribute: "",
  },
  houseTemperature: {
    entityId: "sensor.house_temperature",
    attribute: "",
  },
  houseTarget: {
    entityId: "input_number.house_target_temperature",
    attribute: "",
  },
  camera: {
    cameraId: "front-door",
    entityId: "camera.g5_turret_ultra",
  },
  mediaPlayer: {
    roomId: "living-room",
    entityId: "media_player.apple_tv",
  },
  excludedRoomIds: ["garden"],
  actions: {
    goodNight: { domain: "scene", service: "turn_on", entityId: "scene.good_night" },
    movie: { domain: "scene", service: "turn_on", entityId: "scene.movie" },
    away: { domain: "scene", service: "turn_on", entityId: "scene.away" },
  },
} satisfies {
  outsideTemperature: EntityPropertyBinding;
  houseTemperature: EntityPropertyBinding;
  houseTarget: EntityPropertyBinding;
  camera: CameraBinding;
  mediaPlayer: MediaPlayerBinding;
  excludedRoomIds: string[];
  actions: Record<"goodNight" | "movie" | "away", EntityActionBinding>;
};

// Drying-weather signal behind the top-bar washing reminder. `attribute: ""`
// reads the entity state itself ("on"/"true" means hang it out); name an
// attribute to read that instead.
export const washingBinding: EntityPropertyBinding = {
  entityId: "binary_sensor.good_drying_weather",
  attribute: "",
};

export const roomBindings: RoomBinding[] = [
  {
    roomId: "living-room",
    lights: [
      { lightId: "ceiling", entityId: "light.living_room_ceiling" },
      { lightId: "floor-lamp", entityId: "light.living_room_floor_lamp" },
      { lightId: "shelf-strip", entityId: "light.living_room_shelf_strip" },
      { lightId: "reading-lamp", entityId: "light.living_room_reading_lamp" },
    ],
    covers: [
      { blindId: "south-window", entityId: "cover.living_room_south_window" },
      { blindId: "patio-door", entityId: "cover.living_room_patio_door" },
    ],
    climate: "climate.living_room",
    media: homePageBindings.mediaPlayer.entityId,
  },
  {
    roomId: "kitchen",
    lights: [
      { lightId: "ceiling", entityId: "light.kitchen_ceiling" },
      { lightId: "counter-strip", entityId: "light.kitchen_counter_strip" },
    ],
    covers: [],
    climate: "climate.kitchen",
    media: "media_player.kitchen",
    vacuum: "vacuum.kitchen",
  },
  {
    roomId: "hallway",
    lights: [{ lightId: "ceiling", entityId: "light.hallway_ceiling" }],
    covers: [],
    motion: "binary_sensor.hallway_motion",
  },
  {
    roomId: "bedroom",
    lights: [
      { lightId: "ceiling", entityId: "light.bedroom_ceiling" },
      { lightId: "bedside", entityId: "light.bedroom_bedside" },
    ],
    covers: [{ blindId: "window", entityId: "cover.bedroom_window" }],
    climate: "climate.bedroom",
  },
  {
    roomId: "jaicobs-room",
    lights: [
      { lightId: "ceiling", entityId: "light.jaicobs_room_ceiling" },
      { lightId: "desk", entityId: "light.jaicobs_room_desk" },
    ],
    covers: [{ blindId: "window", entityId: "cover.jaicobs_room_window" }],
    climate: "climate.jaicobs_room",
  },
  {
    roomId: "elsies-room",
    lights: [
      { lightId: "ceiling", entityId: "light.elsies_room_ceiling" },
      { lightId: "night-light", entityId: "light.elsies_room_night_light" },
    ],
    covers: [{ blindId: "window", entityId: "cover.elsies_room_window" }],
    climate: "climate.elsies_room",
  },
  {
    roomId: "garden",
    lights: [{ lightId: "path", entityId: "light.garden_path" }],
    covers: [],
  },
];

export const entryBindings: EntryBinding[] = [
  { entryId: "front-door", lock: "lock.front_door", sensor: "binary_sensor.front_door" },
  { entryId: "back-door", lock: "lock.back_door", sensor: "binary_sensor.back_door" },
  { entryId: "patio-door", lock: "lock.patio_door", sensor: "binary_sensor.patio_door" },
  { entryId: "jaicobs-room-window", sensor: "binary_sensor.jaicobs_room_window" },
  { entryId: "garage", lock: "lock.garage", sensor: "binary_sensor.garage_door" },
];

export const personBindings: PersonBinding[] = [
  { personId: "allister", entityId: "person.allister" },
  { personId: "tonnii", entityId: "person.tonnii" },
  { personId: "elsie", entityId: "person.elsie" },
  { personId: "jaicob", entityId: "person.jaicob" },
];

export const cameraBindings: CameraBinding[] = [
  homePageBindings.camera,
  { cameraId: "driveway", entityId: "camera.driveway" },
  { cameraId: "back-garden", entityId: "camera.back_garden" },
  { cameraId: "hallway", entityId: "camera.hallway" },
];

export const floorsPageBindings = {
  kitchenRoomId: "kitchen",
  livingRoomId: "living-room",
  hallwayRoomId: "hallway",
  bedroomRoomIds: ["bedroom", "elsies-room"],
} as const;

export const securityPageBindings = {
  alarmControlPanel: {
    entityId: "alarm_control_panel.home",
    states: {
      home: "armed_home",
      away: "armed_away",
      disarmed: "disarmed",
    },
    services: {
      home: "alarm_arm_home",
      away: "alarm_arm_away",
      disarmed: "alarm_disarm",
    },
  } satisfies AlarmControlPanelBinding,
  sensorCount:
    entryBindings.filter((binding) => binding.sensor !== undefined).length +
    roomBindings.filter((binding) => binding.motion !== undefined).length,
};

export function roomBindingFor(roomId: string): RoomBinding | undefined {
  return roomBindings.find((binding) => binding.roomId === roomId);
}

function addEntityId(ids: Set<string>, entityId: string | undefined): void {
  if (entityId) ids.add(entityId);
}

// Entity IDs whose state this dashboard actually reads. Used to subscribe
// without pulling every Home Assistant entity over the websocket.
export function watchedEntityIds(): string[] {
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

  return [...ids];
}
