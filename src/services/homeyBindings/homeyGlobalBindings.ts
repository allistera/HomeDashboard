import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { roomBindings } from "@/services/homeyBindings/homeyRoomsBindings";
import {
  cameraBindings,
  entryBindings,
  personBindings,
  securityPageBindings,
} from "@/services/homeyBindings/homeySecurityBindings";

export function roomDeviceIds(roomId: string): string[] {
  const binding = roomBindings.find((room) => room.roomId === roomId);
  return [
    ...new Set(
      [
        ...(binding?.lights.map((light) => light.deviceId) ?? []),
        binding?.media,
        binding?.temperature?.deviceId,
        binding?.climate?.deviceId,
        binding?.motion?.deviceId,
        binding?.vacuum?.deviceId,
      ].filter((id): id is string => !!id),
    ),
  ];
}

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
    for (const id of roomDeviceIds(room.roomId)) ids.add(id);
  }
  for (const entry of entryBindings) {
    if (entry.lock) ids.add(entry.lock.deviceId);
    if (entry.sensor) ids.add(entry.sensor.deviceId);
  }
  for (const person of personBindings) ids.add(person.presence.deviceId);
  for (const camera of cameraBindings) ids.add(camera.deviceId);
  return [...ids];
}
