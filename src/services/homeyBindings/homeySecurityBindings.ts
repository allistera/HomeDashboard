import type { AlarmArmState, DeviceCapabilityBinding } from "@/services/homeyTypes";

export const entryBindings: {
  entryId: string;
  lock?: DeviceCapabilityBinding;
  sensor?: DeviceCapabilityBinding;
}[] = [];
export const personBindings: { personId: string; presence: DeviceCapabilityBinding }[] = [];
export const cameraBindings: {
  cameraId: string;
  deviceId: string;
  snapshotUrl?: string;
  streamUrl?: string;
}[] = [];

// Add a capability or virtual device only when it exists on Homey.
interface SecurityBindings {
  alarmControlPanel?: {
    deviceId: string;
    capabilityId: string;
    states: Record<AlarmArmState, string>;
  };
  sensorCount: number;
}

export const securityPageBindings: SecurityBindings = { sensorCount: 2 };
