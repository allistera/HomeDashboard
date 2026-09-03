import type {
  EntityActionBinding,
  EntityPropertyBinding,
} from "@/services/haBindings/haGlobalBindings";
import { livingRoomMediaBinding } from "@/services/haBindings/haRoomsBindings";
import { frontDoorCameraBinding } from "@/services/haBindings/haSecurityBindings";

// Home-page entity selections live here. Display copy and other presentation-only
// values stay in HomePage; room lights, entries and people use their page bindings.
export const homePageBindings = {
  outsideTemperature: {
    entityId: "sensor.livingston_realfeel_temperature",
    attribute: "",
  },
  houseTemperature: {
    entityId: "sensor.kitchen_temperature_temperature",
    attribute: "",
  },
  houseTarget: {
    entityId: "sensor.kitchen_temperature_temperature",
    attribute: "",
  },
  camera: frontDoorCameraBinding,
  mediaPlayer: livingRoomMediaBinding,
  // Only these entity events are requested from Home Assistant's logbook for
  // the homepage activity feed. Add or remove entity IDs here to change it.
  activityEntityIds: [
    "binary_sensor.front_door_contact",
    "binary_sensor.back_door_contact",
    "binary_sensor.downstairs_hallway_movement_occupancy",
    "camera.garden_garden_camera_medium_quality",
    "camera.g5_turret_ultra_high_resolution_channel",
    "binary_sensor.fire_alarm_smoke",
  ],
  excludedRoomIds: ["garden"],
  actions: {
    goodNight: { domain: "scene", service: "turn_on", entityId: "scene.good_night" },
    movie: { domain: "scene", service: "turn_on", entityId: "scene.movie" },
    away: { domain: "scene", service: "turn_on", entityId: "scene.away" },
  },
} satisfies {
  outsideTemperature: EntityPropertyBinding;
  houseTemperature: EntityPropertyBinding;
  houseTarget: EntityPropertyBinding;
  camera: typeof frontDoorCameraBinding;
  mediaPlayer: typeof livingRoomMediaBinding;
  activityEntityIds: string[];
  excludedRoomIds: string[];
  actions: Record<"goodNight" | "movie" | "away", EntityActionBinding>;
};
