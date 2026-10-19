import {
  cameraBindings,
  entryBindings,
  personBindings,
  securityPageBindings,
} from "@/services/homeyBindings/homeySecurityBindings";
import type { HomeyDevice } from "@/services/homeyTypes";
import type { SecurityState } from "@/models/security";

export function mapHomeySecurity(
  previous: SecurityState,
  devices: Map<string, HomeyDevice>,
): SecurityState {
  const security = {
    ...previous,
    entries: previous.entries.map((entry) => ({ ...entry })),
    people: previous.people.map((person) => ({ ...person })),
  };
  security.mode = "live";
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
      if (panel.capabilitiesObj[alarm.capabilityId]?.value === alarm.states[state]) {
        security.armState = state;
        security.secureSince = "Homey";
      }
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
  security.cameras = [...devices.values()]
    .filter(
      (device) =>
        device.class === "camera" ||
        device.images?.some((image) => image.type === "camera") ||
        device.videos?.some((video) => video.type === "camera"),
    )
    .map((device) => {
      const binding = cameraBindings.find((item) => item.deviceId === device.id);
      const image =
        device.images?.find((item) => item.type === "camera") ??
        device.images?.find((item) => item.imageObj?.url);
      return {
        id: binding?.cameraId ?? device.id,
        deviceId: device.id,
        name: device.name,
        available: device.available,
        snapshotUrl: image?.imageObj?.url ?? binding?.snapshotUrl,
        streamUrl: binding?.streamUrl,
        live:
          device.available &&
          (!!binding?.streamUrl ||
            !!device.videos?.some((video) => video.type === "camera" && video.videoObj?.id)),
      };
    })
    .sort((first, second) => first.name.localeCompare(second.name));
  return security;
}
