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
    climate: "climate.living_room",
    media: livingRoomMediaBinding.entityId,
  },
  {
    roomId: "kitchen",
    lights: [
      { lightId: "ceiling", entityId: "light.kitchen_ceiling" },
      { lightId: "counter-strip", entityId: "light.kitchen_counter_strip" },
    ],
    climate: "climate.kitchen",
    temperature: { entityId: "sensor.kitchen_temperature_temperature", attribute: "" },
    media: "media_player.kitchen",
    vacuum: "vacuum.kitchen",
  },
  {
    roomId: "hallway",
    lights: [{ lightId: "ceiling", entityId: "light.hallway" }],
    motion: "binary_sensor.downstairs_hallway_movement_occupancy",
  },
  {
    roomId: "bedroom",
    lights: [{ lightId: "ceiling", entityId: "light.bedroom_bedroom" }],
    temperature: { entityId: "sensor.bedroom_temperature_temperature", attribute: "" },
  },
  {
    roomId: "jaicobs-room",
    lights: [
      { lightId: "ceiling", entityId: "light.jaicobs_room_ceiling" },
      { lightId: "desk", entityId: "light.jaicobs_room_desk" },
    ],
    climate: "climate.jaicobs_room",
  },
  {
    roomId: "elsies-room",
    lights: [
      { lightId: "ceiling", entityId: "light.elsies_room_ceiling" },
      { lightId: "night-light", entityId: "light.elsies_room_night_light" },
    ],
    climate: "climate.elsies_room",
  },
  {
    roomId: "garden",
    lights: [{ lightId: "path", entityId: "light.garden_path" }],
  },
];

export function roomBindingFor(roomId: string): RoomBinding | undefined {
  return roomBindings.find((binding) => binding.roomId === roomId);
}
