export type EntityId = `${string}.${string}`;

export interface EntityProperty {
  entityId: EntityId;
  attribute?: string;
}

interface RoomBinding {
  roomId: string;
  areas: string[];
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
    lights: [],
    temperature: { entityId: "sensor.kitchen_temperature_temperature" },
    motion: "binary_sensor.kitchen_motion_occupancy",
  },
  {
    roomId: "hallway",
    areas: ["Downstairs Hallway", "Upstairs Hallway"],
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
    lights: [{ lightId: "bedroom-light", entityId: "light.main_bedroom_bedrooms" }],
  },
  {
    roomId: "jaicobs-room",
    areas: ["Jaicobs Room"],
    lights: [],
    media: "media_player.jaicobs_room_jaicobs_xbox",
  },
  {
    roomId: "elsies-room",
    areas: ["Elsies Room", "Elsie’s bedroom"],
    lights: [{ lightId: "ceiling", entityId: "light.elsies_bedroom_elsies_light" }],
    temperature: { entityId: "sensor.elsie_s_room_temperature" },
  },
  { roomId: "garden", areas: ["Back Garden"], lights: [] },
  {
    roomId: "toilet",
    name: "Toilet",
    floor: "Ground floor",
    areas: ["Toilet"],
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
  houseTemperature: { entityId: "sensor.kitchen_temperature_temperature" },
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
