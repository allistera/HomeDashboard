import type { MediaPlayerBinding, RoomBinding } from "@/services/haBindings/haGlobalBindings";

export const livingRoomMediaBinding: MediaPlayerBinding = {
  roomId: "living-room",
  entityId: "media_player.apple_tv",
};

export const roomBindings: RoomBinding[] = [
  {
    roomId: "living-room",
    lights: [
      { lightId: "livingroom-light", entityId: "light.living_room_livingroom_light_2" },
      { lightId: "livingroom-light-2", entityId: "light.livingroom_light_2" },
    ],
    covers: [
      { blindId: "south-window", entityId: "cover.living_room_south_window" },
      { blindId: "patio-door", entityId: "cover.living_room_patio_door" },
    ],
    climate: "climate.living_room",
    media: livingRoomMediaBinding.entityId,
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
    lights: [{ lightId: "ceiling", entityId: "light.hallway" }],
    covers: [],
    motion: "binary_sensor.downstairs_hallway_movement_occupancy",
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

export function roomBindingFor(roomId: string): RoomBinding | undefined {
  return roomBindings.find((binding) => binding.roomId === roomId);
}
