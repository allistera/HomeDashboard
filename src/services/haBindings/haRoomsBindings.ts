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
    climate: "climate.living_room", // TODO: no matching Home Assistant entity.
    media: livingRoomMediaBinding.entityId,
  },
  {
    roomId: "kitchen",
    lights: [],
    climate: "climate.kitchen", // TODO: no matching Home Assistant entity.
    temperature: { entityId: "sensor.kitchen_temperature_temperature", attribute: "" },
    media: "media_player.kitchen_pod",
    motion: "binary_sensor.kitchen_movement_occupancy",
    vacuum: "vacuum.kitchen", // TODO: no matching Home Assistant entity.
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
    lights: [],
    climate: "climate.jaicobs_room", // TODO: no matching Home Assistant entity.
    media: "media_player.jaicobs_xbox",
  },
  {
    roomId: "elsies-room",
    lights: [],
    climate: "climate.elsies_room", // TODO: no matching Home Assistant entity.
  },
  {
    roomId: "garden",
    lights: [],
  },
];

export function roomBindingFor(roomId: string): RoomBinding | undefined {
  return roomBindings.find((binding) => binding.roomId === roomId);
}
