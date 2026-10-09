import type { LightBinding, RoomBinding } from "@/services/homeyTypes";

export const livingRoomLightBindings: LightBinding[] = [
  { lightId: "livingroom-light", deviceId: "6df0691d-a8a9-4244-bf93-1ea1cceeca6f" },
  { lightId: "livingroom-light-2", deviceId: "20f86d7a-8b47-4189-9264-1ec0e3e160e4" },
];

export const hallwayLightBindings: LightBinding[] = [
  { lightId: "downstairs-hallway-light", deviceId: "50cd1111-47b0-4276-aab8-972a055bfb03" },
  { lightId: "upstairs-hallway-light", deviceId: "b5941eee-99eb-407d-90d4-256599160ed7" },
];

// IDs come from the connected Homey inventory, not names or HA entity IDs.
export const livingRoomMediaBinding = {
  roomId: "living-room",
  deviceId: "76e05f8e-87b3-493e-bc6f-4b6ec6aa5665",
};

export const roomBindings: RoomBinding[] = [
  {
    roomId: "living-room",
    lights: livingRoomLightBindings,
    media: livingRoomMediaBinding.deviceId,
  },
  { roomId: "kitchen", lights: [] },
  {
    roomId: "hallway",
    lights: hallwayLightBindings,
    motion: { deviceId: "4afb514a-cf25-4bb3-b465-7a8866fcf927", capabilityId: "alarm_motion" },
  },
  { roomId: "bedroom", lights: [] },
  { roomId: "jaicobs-room", lights: [] },
  { roomId: "elsies-room", lights: [] },
  { roomId: "garden", lights: [] },
  {
    roomId: "toilet",
    name: "Toilet",
    floor: "Ground floor",
    lights: [],
    motion: { deviceId: "bb4296b0-9fa6-4a0e-b43b-e5671423aed3", capabilityId: "alarm_motion" },
  },
];

export function roomBindingFor(roomId: string): RoomBinding | undefined {
  return roomBindings.find((binding) => binding.roomId === roomId);
}
