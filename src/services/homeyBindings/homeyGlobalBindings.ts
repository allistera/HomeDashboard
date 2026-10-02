import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { roomBindings } from "@/services/homeyBindings/homeyRoomsBindings";
import {
  cameraBindings,
  entryBindings,
  personBindings,
  securityPageBindings,
} from "@/services/homeyBindings/homeySecurityBindings";

export function watchedDeviceIds(): string[] {
  const ids = new Set(homePageBindings.activityDeviceIds);
  for (const binding of [
    homePageBindings.outsideTemperature,
    homePageBindings.houseTemperature,
    homePageBindings.houseTarget,
    homePageBindings.washingWeather,
    securityPageBindings.alarmControlPanel,
  ]) {
    if (binding) ids.add(binding.deviceId);
  }
  for (const room of roomBindings) {
    for (const light of room.lights) ids.add(light.deviceId);
    if (room.media) ids.add(room.media);
    for (const binding of [room.temperature, room.climate, room.motion, room.vacuum]) {
      if (binding) ids.add(binding.deviceId);
    }
  }
  for (const entry of entryBindings) {
    if (entry.lock) ids.add(entry.lock.deviceId);
    if (entry.sensor) ids.add(entry.sensor.deviceId);
  }
  for (const person of personBindings) ids.add(person.presence.deviceId);
  for (const camera of cameraBindings) ids.add(camera.deviceId);
  return [...ids];
}
