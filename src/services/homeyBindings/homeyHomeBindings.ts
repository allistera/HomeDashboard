import type { DeviceCapabilityBinding } from "@/services/homeyTypes";
import {
  hallwayLightBindings,
  livingRoomLightBindings,
  livingRoomMediaBinding,
  toiletLightBindings,
} from "@/services/homeyBindings/homeyRoomsBindings";

// Leave unavailable devices unbound; never invent device IDs.
interface HomeBindings {
  outsideTemperature?: DeviceCapabilityBinding;
  houseTemperature?: DeviceCapabilityBinding;
  houseTarget?: DeviceCapabilityBinding;
  washingWeather?: DeviceCapabilityBinding;
  camera: { cameraId: string; deviceId?: string };
  mediaPlayer: typeof livingRoomMediaBinding;
  activityDeviceIds: string[];
  excludedRoomIds: string[];
  roomZoneIds: Record<string, string>;
}

export const homePageBindings: HomeBindings = {
  roomZoneIds: {
    "living-room": "19d2530e-a1fc-43f4-ba0c-1269889ebf21",
    kitchen: "61bed053-197d-4829-98eb-e3974e704aa4",
    hallway: "a16e4f05-875c-4ca0-a933-be7889217fc1",
    bedroom: "d450a27b-1a36-44d3-a517-2fa4f3e533f9",
    "jaicobs-room": "3acb3f11-a2d3-4dc3-b7ee-034352fbaadc",
    "elsies-room": "2a153501-3a96-463a-b8e8-7c1f671aaf44",
    toilet: "0aa1fe69-2b97-4643-9a13-4c0966224ca5",
  },
  camera: { cameraId: "front-door" },
  mediaPlayer: livingRoomMediaBinding,
  activityDeviceIds: [
    ...toiletLightBindings.map((light) => light.deviceId),
    ...hallwayLightBindings.map((light) => light.deviceId),
    ...livingRoomLightBindings.map((light) => light.deviceId),
    livingRoomMediaBinding.deviceId,
    "4afb514a-cf25-4bb3-b465-7a8866fcf927",
    "bb4296b0-9fa6-4a0e-b43b-e5671423aed3",
  ],
  excludedRoomIds: ["garden"],
};
