import { parseHomeyConfig } from "@/services/homeyBindings/parseHomeyConfig";
import source from "@/config/homey.yaml?raw";
import type { AlarmArmState, DeviceCapabilityBinding, RoomBinding } from "@/services/homeyTypes";

interface HomeBindings {
  outsideTemperature?: DeviceCapabilityBinding;
  houseTemperature?: DeviceCapabilityBinding;
  houseTarget?: DeviceCapabilityBinding;
  outsideTemperatureTokenId: string;
  washingWeather?: DeviceCapabilityBinding;
  camera: { cameraId: string; deviceId?: string };
  mediaPlayer: { roomId: string; deviceId: string };
  activityDeviceIds: string[];
  excludedRoomIds: string[];
  roomZoneIds: Record<string, string>;
}

interface SecurityBindings {
  alarmControlPanel?: {
    deviceId: string;
    capabilityId: string;
    states: Record<AlarmArmState, string>;
  };
  sensorCount: number;
}

export interface HomeyConfig {
  home: HomeBindings;
  rooms: RoomBinding[];
  floors: {
    kitchenRoomId: string;
    livingRoomId: string;
    hallwayRoomId: string;
    bedroomRoomIds: string[];
    jaicobsRoomId: string;
  };
  security: SecurityBindings & {
    entries: {
      entryId: string;
      lock?: DeviceCapabilityBinding;
      sensor?: DeviceCapabilityBinding;
    }[];
    people: { personId: string; presence: DeviceCapabilityBinding }[];
    cameras: { cameraId: string; deviceId: string; snapshotUrl?: string; streamUrl?: string }[];
  };
}

// Validate bundled YAML before exposing it to stores and pages.
export const homeyConfig: HomeyConfig = parseHomeyConfig(source);
