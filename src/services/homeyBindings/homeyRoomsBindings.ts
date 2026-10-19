import { homeyConfig } from "@/services/homeyBindings/homeyConfig";
import type { RoomBinding } from "@/services/homeyTypes";

export const roomBindings = homeyConfig.rooms;
export const livingRoomMediaBinding = homeyConfig.home.mediaPlayer;

export function roomBindingFor(roomId: string): RoomBinding | undefined {
  return roomBindings.find((binding) => binding.roomId === roomId);
}
