import type { HomeyDevice } from "@/services/homeyTypes";
import { mapHomeyRooms } from "@/services/homeyRoomMapping";
import { mapHomeySecurity } from "@/services/homeySecurityMapping";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
export { numericCapabilityFrom, lightLevelFrom } from "@/services/homeyCapabilities";

export function applyDevices(
  devices: Map<string, HomeyDevice>,
  rooms = useRoomsStore(),
  security = useSecurityStore(),
): void {
  rooms.$patch(mapHomeyRooms(rooms.$state, devices));
  security.$patch(mapHomeySecurity(security.$state, devices));
}
