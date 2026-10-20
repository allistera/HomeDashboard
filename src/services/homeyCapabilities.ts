import type { DeviceCapabilityBinding, HomeyDevice } from "@/services/homeyTypes";
export function numericCapabilityFrom(
  devices: Map<string, HomeyDevice>,
  binding: DeviceCapabilityBinding | undefined,
): number | null {
  if (!binding) return null;
  const device = devices.get(binding.deviceId);
  const value = device?.capabilitiesObj[binding.capabilityId]?.value;
  return device?.available && Number.isFinite(value) ? Number(value) : null;
}

export function lightLevelFrom(device: HomeyDevice): number {
  if (!device.available || device.capabilitiesObj.onoff?.value !== true) return 0;
  const dim = device.capabilitiesObj.dim?.value;
  return Number.isFinite(dim) ? Math.round(Math.max(0, Math.min(1, Number(dim))) * 100) : 100;
}

export function changedAt(device: HomeyDevice, capabilityId: string): number | undefined {
  const date = device.capabilitiesObj[capabilityId]?.lastUpdated;
  if (!date) return undefined;
  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : undefined;
}
