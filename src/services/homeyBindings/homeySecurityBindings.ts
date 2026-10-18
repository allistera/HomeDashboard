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
}[] = [{ cameraId: "front-door", deviceId: "0c7f09c5-98ea-4cf2-ac1c-804acbbb9abc" }];

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
