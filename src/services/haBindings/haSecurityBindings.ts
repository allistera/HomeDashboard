import type {
  AlarmControlPanelBinding,
  CameraBinding,
  EntryBinding,
  PersonBinding,
} from "@/services/haBindings/haGlobalBindings";
import { roomBindings } from "@/services/haBindings/haRoomsBindings";

export const entryBindings: EntryBinding[] = [
  {
    entryId: "front-door",
    lock: "lock.front_door", // TODO: no matching Home Assistant entity.
    sensor: "binary_sensor.front_door_contact",
  },
  {
    entryId: "back-door",
    lock: "lock.back_door", // TODO: no matching Home Assistant entity.
    sensor: "binary_sensor.back_door_contact",
  },
  {
    entryId: "patio-door",
    lock: "lock.patio_door", // TODO: no matching Home Assistant entity.
    sensor: "binary_sensor.patio_door", // TODO: no matching Home Assistant entity.
  },
  {
    entryId: "jaicobs-room-window",
    sensor: "binary_sensor.jaicobs_room_window", // TODO: no matching Home Assistant entity.
  },
  {
    entryId: "garage",
    lock: "lock.garage", // TODO: no matching Home Assistant entity.
    sensor: "binary_sensor.garage_door", // TODO: no matching Home Assistant entity.
  },
];

export const personBindings: PersonBinding[] = [
  { personId: "allister", entityId: "person.allister_antosik" },
  { personId: "tonnii", entityId: "person.tonnii" }, // TODO: no matching Home Assistant entity.
  { personId: "elsie", entityId: "person.elsie" }, // TODO: no matching Home Assistant entity.
  { personId: "jaicob", entityId: "person.jaicob" }, // TODO: no matching Home Assistant entity.
];

export const frontDoorCameraBinding: CameraBinding = {
  cameraId: "front-door",
  entityId: "camera.g5_turret_ultra_high_resolution_channel",
};

export const cameraBindings: CameraBinding[] = [
  frontDoorCameraBinding,
  { cameraId: "back-garden", entityId: "camera.garden_garden_camera_medium_quality" },
  { cameraId: "driveway", entityId: "camera.driveway" }, // TODO: no matching Home Assistant entity.
  { cameraId: "hallway", entityId: "camera.hallway" }, // TODO: no matching Home Assistant entity.
];

export const securityPageBindings = {
  alarmControlPanel: {
    entityId: "alarm_control_panel.udm_se_colliery_lane_alarm_manager",
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
