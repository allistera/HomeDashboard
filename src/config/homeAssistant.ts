export type EntityId = `${string}.${string}`;

export interface EntityProperty {
  entityId: EntityId;
  attribute?: string;
}

interface RoomBinding {
  roomId: string;
  areas: string[];
  deviceAllowlist: EntityId[];
  name?: string;
  floor?: string;
  lights: { lightId: string; entityId: EntityId }[];
  temperature?: EntityProperty;
  climate?: EntityId;
  media?: EntityId;
  motion?: EntityId;
  vacuum?: EntityId;
}

export const roomBindings: RoomBinding[] = [
  {
    roomId: "living-room",
    areas: ["Living Room"],
    deviceAllowlist: [
      "light.living_room_livingroom_light",
      "light.living_room_livingroom_light_2",
      "sensor.livingroom_temperature_temperature",
      "media_player.living_room_apple_tv",
      "binary_sensor.living_room_presence_sensor_occupancy",
    ],
    lights: [
      { lightId: "livingroom-light", entityId: "light.living_room_livingroom_light" },
      { lightId: "livingroom-light-2", entityId: "light.living_room_livingroom_light_2" },
    ],
    temperature: { entityId: "sensor.livingroom_temperature_temperature" },
    media: "media_player.living_room_apple_tv",
    motion: "binary_sensor.living_room_presence_sensor_occupancy",
  },
  {
    roomId: "kitchen",
    areas: ["Kitchen"],
    deviceAllowlist: [
      "sensor.kitchen_temperature_temperature",
      "binary_sensor.kitchen_motion_occupancy",
    ],
    lights: [],
    temperature: { entityId: "sensor.kitchen_temperature_temperature" },
    motion: "binary_sensor.kitchen_motion_occupancy",
  },
  {
    roomId: "hallway",
    areas: ["Downstairs Hallway", "Upstairs Hallway"],
    deviceAllowlist: [
      "light.downstairs_hallway_downstairs_hallway_light",
      "light.upstairs_hallway_upstairs_hallway_light",
      "sensor.hallway_temperature_temperature",
      "binary_sensor.hallway_motion_occupancy",
    ],
    lights: [
      {
        lightId: "downstairs-hallway-light",
        entityId: "light.downstairs_hallway_downstairs_hallway_light",
      },
      {
        lightId: "upstairs-hallway-light",
        entityId: "light.upstairs_hallway_upstairs_hallway_light",
      },
    ],
    temperature: { entityId: "sensor.hallway_temperature_temperature" },
    motion: "binary_sensor.hallway_motion_occupancy",
  },
  {
    roomId: "bedroom",
    areas: ["Main Bedroom"],
    deviceAllowlist: [
      "sensor.bedroom_temperature_temperature",
      "sensor.bedroom_temperature_humidity",
      "sensor.bedroom_temperature_battery",
      "sensor.main_bedroom_bedroom_switch_battery",
      "event.main_bedroom_bedroom_switch_button_1",
      "event.main_bedroom_bedroom_switch_button_2",
      "event.main_bedroom_bedroom_switch_button_3",
      "event.main_bedroom_bedroom_switch_button_4",
      "event.main_bedroom_bedroom_switch_rotary",
    ],
    lights: [],
    temperature: { entityId: "sensor.bedroom_temperature_temperature" },
  },
  {
    roomId: "jaicobs-room",
    areas: ["Jaicobs Room"],
    deviceAllowlist: ["media_player.jaicobs_room_jaicobs_xbox", "sensor.jaicob_s_room_temperature"],
    lights: [],
    temperature: { entityId: "sensor.jaicob_s_room_temperature" },
    media: "media_player.jaicobs_room_jaicobs_xbox",
  },
  {
    roomId: "elsies-room",
    areas: ["Elsies Room", "Elsie’s bedroom"],
    deviceAllowlist: ["light.elsies_bedroom_elsies_light", "sensor.elsie_s_room_temperature"],
    lights: [{ lightId: "ceiling", entityId: "light.elsies_bedroom_elsies_light" }],
    temperature: { entityId: "sensor.elsie_s_room_temperature" },
  },
  {
    roomId: "garden",
    areas: ["Back Garden"],
    deviceAllowlist: ["camera.back_garden_back_garden_high_resolution_channel"],
    lights: [],
  },
  {
    roomId: "toilet",
    name: "Toilet",
    floor: "Ground floor",
    areas: ["Toilet"],
    deviceAllowlist: [
      "light.toilet_toilet_light",
      "sensor.toilet_temperature_temperature",
      "binary_sensor.toilet_motion_occupancy",
    ],
    lights: [{ lightId: "toilet_toilet_light", entityId: "light.toilet_toilet_light" }],
    temperature: { entityId: "sensor.toilet_temperature_temperature" },
    motion: "binary_sensor.toilet_motion_occupancy",
  },
];

export function roomBindingFor(roomId: string): RoomBinding | undefined {
  return roomBindings.find((binding) => binding.roomId === roomId);
}

export function roomEntityIds(roomId: string): string[] {
  const binding = roomBindingFor(roomId);
  if (!binding) return [];
  return [
    ...binding.lights.map((light) => light.entityId),
    binding.temperature?.entityId,
    binding.climate,
    binding.media,
    binding.motion,
    binding.vacuum,
  ].filter((id): id is EntityId => id !== undefined);
}

interface EntryBinding {
  entryId: string;
  sensor?: EntityId;
  lock?: EntityId;
}

export const entryBindings: EntryBinding[] = [
  { entryId: "front-door", sensor: "binary_sensor.front_door_contact" },
  { entryId: "back-door", sensor: "binary_sensor.back_door_contact" },
];

export const securityPageBindings = {
  alarmControlPanel: "alarm_control_panel.downstairs_cupboard_udm_se_colliery_lane_alarm_manager",
  people: ["person.allister_antosik", "person.tonnii_antosik", "person.jaicob_antosik"],
  frontDoorCamera: "camera.back_garden_g5_turret_ultra_high_resolution_channel",
} satisfies {
  alarmControlPanel: EntityId;
  people: EntityId[];
  frontDoorCamera: EntityId;
};

interface HomeBindings {
  outsideTemperature: EntityProperty;
  houseTemperature: EntityProperty;
  houseTarget?: EntityProperty;
  washingWeather?: EntityProperty;
  mediaPlayer: { roomId: string };
  excludedRoomIds: string[];
  activityEntityIds: string[];
}

export const homePageBindings: HomeBindings = {
  outsideTemperature: { entityId: "weather.home", attribute: "temperature" },
  houseTemperature: { entityId: "sensor.average_indoor_temperature" },
  washingWeather: { entityId: "binary_sensor.good_drying_weather" },
  mediaPlayer: { roomId: "living-room" },
  excludedRoomIds: ["garden"],
  activityEntityIds: [
    ...roomBindings.flatMap((binding) => roomEntityIds(binding.roomId)),
    ...entryBindings.flatMap((entry) => entry.sensor ?? []),
    ...securityPageBindings.people,
    securityPageBindings.alarmControlPanel,
  ],
};

export const floorsPageBindings = {
  kitchenRoomId: "kitchen",
  livingRoomId: "living-room",
  hallwayRoomId: "hallway",
  bedroomRoomIds: ["bedroom", "elsies-room"],
  jaicobsRoomId: "jaicobs-room",
};
