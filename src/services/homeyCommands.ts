import type { CapabilityValue } from "@/services/homeyTypes";
import { useHomeyStore } from "@/stores/homey";

export function setHomeyCapability(
  deviceId: string,
  capabilityId: string,
  value: Exclude<CapabilityValue, null>,
) {
  return useHomeyStore().transport.setCapability(deviceId, capabilityId, value);
}
export function setHomeyLight(deviceId: string, level: number) {
  return useHomeyStore().transport.setLight(deviceId, level);
}
export function homeyCameraVideo(deviceId: string) {
  return useHomeyStore().transport.cameraVideo(deviceId);
}
