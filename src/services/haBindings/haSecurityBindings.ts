import type {
  AlarmControlPanelBinding,
  CameraBinding,
  EntryBinding,
  PersonBinding,
} from "@/services/haBindings/haGlobalBindings";
import { roomBindings } from "@/services/haBindings/haRoomsBindings";

export const entryBindings: EntryBinding[] = [
  { entryId: "front-door", lock: "lock.front_door", sensor: "binary_sensor.front_door" },
  { entryId: "back-door", lock: "lock.back_door", sensor: "binary_sensor.back_door" },
  { entryId: "patio-door", lock: "lock.patio_door", sensor: "binary_sensor.patio_door" },
  { entryId: "jaicobs-room-window", sensor: "binary_sensor.jaicobs_room_window" },
  { entryId: "garage", lock: "lock.garage", sensor: "binary_sensor.garage_door" },
];

export const personBindings: PersonBinding[] = [
  { personId: "allister", entityId: "person.allister" },
  { personId: "tonnii", entityId: "person.tonnii" },
  { personId: "elsie", entityId: "person.elsie" },
  { personId: "jaicob", entityId: "person.jaicob" },
];

export const frontDoorCameraBinding: CameraBinding = {
  cameraId: "front-door",
  entityId: "camera.g5_turret_ultra_high_resolution_channel",
};

export const cameraBindings: CameraBinding[] = [
  frontDoorCameraBinding,
  { cameraId: "driveway", entityId: "camera.driveway" },
  { cameraId: "back-garden", entityId: "camera.back_garden_high_resolution_channel" },
  { cameraId: "hallway", entityId: "camera.hallway" },
];

export const securityPageBindings = {
  alarmControlPanel: {
    entityId: "alarm_control_panel.home",
    states: {
      home: "armed_home",
      away: "armed_away",
      disarmed: "disarmed",
    },
    services: {
      home: "alarm_arm_home",
      away: "alarm_arm_away",
      disarmed: "alarm_disarm",
    },
  } satisfies AlarmControlPanelBinding,
  sensorCount:
    entryBindings.filter((binding) => binding.sensor !== undefined).length +
    roomBindings.filter((binding) => binding.motion !== undefined).length,
};
