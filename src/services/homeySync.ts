import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { roomBindings } from "@/services/homeyBindings/homeyRoomsBindings";
import {
  cameraBindings,
  entryBindings,
  personBindings,
  securityPageBindings,
} from "@/services/homeyBindings/homeySecurityBindings";
import type { DeviceCapabilityBinding, HomeyDevice } from "@/services/homeyTypes";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

export function numericCapabilityFrom(
  devices: Map<string, HomeyDevice>,
  binding: DeviceCapabilityBinding | undefined,
): number | null {
  if (!binding) return null;
  const device = devices.get(binding.deviceId);
  const value = device?.capabilitiesObj[binding.capabilityId]?.value;
  return device?.available && Number.isFinite(value) ? Number(value) : null;
}

export function lightLevelFrom(device: HomeyDevice): number {
  if (!device.available || device.capabilitiesObj.onoff?.value !== true) return 0;
  const dim = device.capabilitiesObj.dim?.value;
  return Number.isFinite(dim) ? Math.round(Math.max(0, Math.min(1, Number(dim))) * 100) : 100;
}

function changedAt(device: HomeyDevice, capabilityId: string): number | undefined {
  const date = device.capabilitiesObj[capabilityId]?.lastUpdated;
  if (!date) return undefined;
  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : undefined;
}

export function applyDevices(devices: Map<string, HomeyDevice>): void {
  const rooms = useRoomsStore();
  const security = useSecurityStore();
  rooms.dataFromHomey = true;
  rooms.setHomeClimateValues(
    numericCapabilityFrom(devices, homePageBindings.outsideTemperature),
    numericCapabilityFrom(devices, homePageBindings.houseTemperature),
    numericCapabilityFrom(devices, homePageBindings.houseTarget),
  );
  const washing = homePageBindings.washingWeather;
  rooms.washingWeatherOk =
    washing && devices.get(washing.deviceId)?.available
      ? devices.get(washing.deviceId)?.capabilitiesObj[washing.capabilityId]?.value === true
      : null;
  for (const binding of roomBindings) {
    if (!rooms.rooms.some((room) => room.id === binding.roomId) && binding.name) {
      rooms.rooms.push({
        id: binding.roomId,
        name: binding.name,
        floor: binding.floor ?? "",
        lights: [],
        temp: null,
        target: null,
        meta: "",
        events: [],
        deviceCount: 0,
        offlineCount: 0,
      });
    }
  }
  for (const room of rooms.rooms) {
    const binding = roomBindings.find((item) => item.roomId === room.id);
    const zoneId = homePageBindings.roomZoneIds[room.id];
    room.devices = [...devices.values()]
      .filter((device) => !!zoneId && device.zone === zoneId)
      .map((device) => ({
        id: device.id,
        name: device.name,
        type: device.class,
        available: device.available,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
    room.lights = (binding?.lights ?? []).flatMap((light) => {
      const device = devices.get(light.deviceId);
      return device
        ? [{ id: light.lightId, name: device.name, level: lightLevelFrom(device) }]
        : [];
    });
    room.temp =
      numericCapabilityFrom(devices, binding?.temperature) ??
      (binding?.climate
        ? numericCapabilityFrom(devices, {
            deviceId: binding.climate.deviceId,
            capabilityId: "measure_temperature",
          })
        : null);
    room.target = numericCapabilityFrom(devices, binding?.climate);
    room.meta = "";
    room.events = [];
    room.climateMode = undefined;
    const media = binding?.media ? devices.get(binding.media) : undefined;
    room.media = media?.available
      ? {
          title: String(media.capabilitiesObj.speaker_track?.value ?? "Nothing playing"),
          output: String(media.capabilitiesObj.sonos_group?.value ?? media.name),
          playing: media.capabilitiesObj.speaker_playing?.value === true,
          active: media.capabilitiesObj.speaker_playing?.value === true,
        }
      : undefined;
    const motion = binding?.motion;
    const sensor = motion ? devices.get(motion.deviceId) : undefined;
    const timestamp = sensor && motion ? changedAt(sensor, motion.capabilityId) : undefined;
    room.motion =
      sensor?.available && motion
        ? {
            active: sensor.capabilitiesObj[motion.capabilityId]?.value === true,
            lastChanged:
              timestamp === undefined
                ? "UNKNOWN"
                : new Date(timestamp).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
            lastChangedAt: timestamp,
          }
        : undefined;
    const vacuum = binding?.vacuum;
    const cleaner = vacuum ? devices.get(vacuum.deviceId) : undefined;
    room.vacuum =
      cleaner?.available && vacuum
        ? { state: String(cleaner.capabilitiesObj[vacuum.capabilityId]?.value ?? "Unknown") }
        : undefined;
    room.deviceCount = room.devices.length;
    room.offlineCount = room.devices.filter((device) => !device.available).length;
  }

  security.dataFromHomey = true;
  security.entries = security.entries.filter((entry) =>
    entryBindings.some((binding) => binding.entryId === entry.id),
  );
  for (const entry of security.entries) {
    const binding = entryBindings.find((item) => item.entryId === entry.id);
    const lock = binding?.lock ? devices.get(binding.lock.deviceId) : undefined;
    const sensor = binding?.sensor ? devices.get(binding.sensor.deviceId) : undefined;
    entry.locked =
      lock?.available && binding?.lock
        ? lock.capabilitiesObj[binding.lock.capabilityId]?.value === true
        : false;
    entry.open =
      sensor?.available && binding?.sensor
        ? sensor.capabilitiesObj[binding.sensor.capabilityId]?.value === true
        : false;
    entry.detail = sensor?.available ? (entry.open ? "OPEN" : "CLOSED") : "UNAVAILABLE";
  }
  const alarm = securityPageBindings.alarmControlPanel;
  const panel = alarm ? devices.get(alarm.deviceId) : undefined;
  security.alarmAvailable = !!panel?.available;
  if (panel && alarm) {
    for (const state of ["home", "away", "disarmed"] as const) {
      if (panel.capabilitiesObj[alarm.capabilityId]?.value === alarm.states[state])
        security.setArmStateFromHomey(state, "Homey");
    }
  }
  for (const person of security.people) {
    const binding = personBindings.find((item) => item.personId === person.id);
    const device = binding ? devices.get(binding.presence.deviceId) : undefined;
    person.home =
      device?.available && binding
        ? device.capabilitiesObj[binding.presence.capabilityId]?.value === true
        : false;
    person.status = device?.available ? (person.home ? "HOME" : "AWAY") : "UNAVAILABLE";
  }
  security.events = [];
  for (const camera of security.cameras) {
    const binding = cameraBindings.find((item) => item.cameraId === camera.id);
    const device = binding ? devices.get(binding.deviceId) : undefined;
    camera.deviceId = binding?.deviceId;
    camera.snapshotUrl = device?.available ? binding?.snapshotUrl : undefined;
    camera.streamUrl = device?.available ? binding?.streamUrl : undefined;
    camera.live = !!camera.streamUrl;
    camera.note = camera.live ? undefined : "UNAVAILABLE IN HOMEY";
  }
}

export function temperatureText(value: number | null, digits = 1): string {
  return value === null ? "—" : `${value.toFixed(digits)}°`;
}
