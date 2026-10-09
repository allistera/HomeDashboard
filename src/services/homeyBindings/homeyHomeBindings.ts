import type { DeviceCapabilityBinding } from "@/services/homeyTypes";
import {
  hallwayLightBindings,
  livingRoomLightBindings,
  livingRoomMediaBinding,
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
}

export const homePageBindings: HomeBindings = {
  camera: { cameraId: "front-door" },
  mediaPlayer: livingRoomMediaBinding,
  activityDeviceIds: [
    ...hallwayLightBindings.map((light) => light.deviceId),
    ...livingRoomLightBindings.map((light) => light.deviceId),
    livingRoomMediaBinding.deviceId,
    "4afb514a-cf25-4bb3-b465-7a8866fcf927",
    "bb4296b0-9fa6-4a0e-b43b-e5671423aed3",
  ],
  excludedRoomIds: ["garden"],
};
