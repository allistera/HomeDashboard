import type { RoomBinding } from "@/services/homeyTypes";

// IDs come from the connected Homey inventory, not names or HA entity IDs.
export const livingRoomMediaBinding = {
  roomId: "living-room",
  deviceId: "76e05f8e-87b3-493e-bc6f-4b6ec6aa5665",
};

export const roomBindings: RoomBinding[] = [
  { roomId: "living-room", lights: [], media: livingRoomMediaBinding.deviceId },
  { roomId: "kitchen", lights: [] },
  {
    roomId: "hallway",
    lights: [],
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
