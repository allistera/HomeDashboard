import type { CapabilityValue, HomeyDevice } from "@/services/homeyTypes";

export interface ActivityEvent {
  id: string;
  occurredAt: number;
  time: string;
  text: string;
  sourceId: string;
  sourceName: string;
  domain: string;
  accent?: boolean;
}

const eventCapabilities = new Set([
  "alarm_motion",
  "alarm_contact",
  "alarm_smoke",
  "locked",
  "onoff",
  "speaker_playing",
  "speaker_track",
]);

export function activityEventFromHomey(
  device: HomeyDevice,
  capabilityId: string,
  value: CapabilityValue,
  changedAt: Date,
): ActivityEvent | null {
  if (
    !eventCapabilities.has(capabilityId) ||
    value === null ||
    !Number.isFinite(changedAt.getTime())
  )
    return null;
  let detail = `changed to ${value}`;
  switch (capabilityId) {
    case "alarm_motion":
      detail = value ? "detected motion" : "motion cleared";
      break;
    case "alarm_contact":
      detail = value ? "opened" : "closed";
      break;
    case "alarm_smoke":
      detail = value ? "detected smoke" : "smoke cleared";
      break;
    case "locked":
      detail = value ? "locked" : "unlocked";
      break;
    case "onoff":
      detail = value ? "turned on" : "turned off";
      break;
    case "speaker_playing":
      detail = value ? "started playing" : "paused";
      break;
    case "speaker_track":
      detail = `playing ${value}`;
      break;
  }
  const occurredAt = changedAt.getTime();
  return {
    id: `${device.id}:${capabilityId}:${occurredAt}:${value}`,
    occurredAt,
    time: changedAt
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      .replace(/\s?[AP]M$/, ""),
    text: `${device.name} ${detail}`,
    sourceId: device.id,
    sourceName: device.name,
    domain: device.class,
    accent: capabilityId.startsWith("alarm_") || capabilityId === "locked",
  };
}

export function activityEventFromInsight(
  device: HomeyDevice,
  title: string,
  value: string | number | boolean,
  timestamp: string | number,
): ActivityEvent | null {
  const parsedTimestamp = new Date(timestamp).getTime();
  const occurredAt = parsedTimestamp < 1e12 ? parsedTimestamp * 1000 : parsedTimestamp;
  const changedAt = new Date(occurredAt);
  if (!Number.isFinite(changedAt.getTime())) return null;
  const text =
    value === true || value === false
      ? `${device.name} ${title.toLocaleLowerCase()}`
      : `${device.name} ${title.toLocaleLowerCase()} changed to ${value}`;
  return {
    id: `${device.id}:${title}:${occurredAt}:${value}`,
    occurredAt,
    time: changedAt
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      .replace(/\s?[AP]M$/, ""),
    text,
    sourceId: device.id,
    sourceName: device.name,
    domain: device.class,
    accent: title.toLowerCase().includes("motion") || title.toLowerCase().includes("contact"),
  };
}
