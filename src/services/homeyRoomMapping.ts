import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { roomBindings } from "@/services/homeyBindings/homeyRoomsBindings";
import { numericCapabilityFrom, lightLevelFrom, changedAt } from "@/services/homeyCapabilities";
import type { HomeyDevice } from "@/services/homeyTypes";
import type { RoomsState } from "@/models/rooms";

export function mapHomeyRooms(previous: RoomsState, devices: Map<string, HomeyDevice>): RoomsState {
  const rooms = { ...previous, rooms: previous.rooms.map((room) => ({ ...room })) };
  rooms.mode = "live";
  const climateValues = [
    homePageBindings.outsideTemperature
      ? numericCapabilityFrom(devices, homePageBindings.outsideTemperature)
      : rooms.outsideTempFromHomey,
    numericCapabilityFrom(devices, homePageBindings.houseTemperature),
    numericCapabilityFrom(devices, homePageBindings.houseTarget),
  ];
  rooms.outsideTempFromHomey = climateValues[0];
  rooms.houseTempFromHomey = climateValues[1];
  rooms.houseTargetFromHomey = climateValues[2];
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
        properties: device.capabilities.map((id) => ({
          id,
          name: device.capabilitiesObj[id]?.title || id.replace(/[_.]/g, " "),
          value: device.capabilitiesObj[id]?.value ?? null,
          units: device.capabilitiesObj[id]?.units,
        })),
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
    const camera = room.devices.find((device) => device.type === "camera");
    room.camera = camera
      ? {
          id: camera.id,
          name: camera.name,
          available: camera.available,
          snapshotUrl: devices.get(camera.id)?.images?.find((image) => image.imageObj?.url)
            ?.imageObj?.url,
        }
      : undefined;
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

  return rooms;
}
