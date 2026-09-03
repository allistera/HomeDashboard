export interface HaLogbookEntry {
  when: number | string;
  name?: string;
  message?: string;
  entity_id?: string;
  domain?: string;
  state?: string;
  context_id?: string;
}

interface HaLogbookStreamMessage {
  events: HaLogbookEntry[];
}

interface HaLogbookStreamRequest {
  type: "logbook/event_stream";
  start_time: string;
  entity_ids?: string[];
}

export interface ActivitySubscribeConnection {
  subscribeMessage(
    callback: (message: HaLogbookStreamMessage) => void,
    message: HaLogbookStreamRequest,
  ): Promise<() => void | Promise<void>>;
}

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

const SECURITY_DOMAINS = new Set(["alarm_control_panel", "camera", "lock"]);

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timestampFrom(value: number | string): number | null {
  const numericValue = Number(value);
  const timestamp = Number.isFinite(numericValue) ? numericValue * 1000 : Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sourceNameFrom(entry: HaLogbookEntry): string {
  if (entry.name?.trim()) return entry.name.trim();
  if (entry.entity_id) return titleCase(entry.entity_id.split(".").at(-1) ?? entry.entity_id);
  if (entry.domain) return titleCase(entry.domain);
  return "Home Assistant";
}

function stateText(state: string): string {
  const normalized = state.trim().toLowerCase();
  const phrases = new Map([
    ["on", "turned on"],
    ["off", "turned off"],
    ["open", "opened"],
    ["closed", "closed"],
    ["locked", "locked"],
    ["unlocked", "unlocked"],
    ["home", "arrived home"],
    ["not_home", "left home"],
    ["playing", "started playing"],
    ["unavailable", "became unavailable"],
  ]);
  return phrases.get(normalized) ?? `changed to ${titleCase(state)}`;
}

export function activityEventFromHa(entry: HaLogbookEntry): ActivityEvent | null {
  const occurredAt = timestampFrom(entry.when);
  if (occurredAt === null) return null;

  const sourceName = sourceNameFrom(entry);
  const domain = entry.domain ?? entry.entity_id?.split(".")[0] ?? "homeassistant";
  const sourceId = entry.entity_id ?? `${domain}:${sourceName.toLowerCase().replaceAll(" ", "-")}`;
  const detail = entry.message?.trim() || (entry.state ? stateText(entry.state) : "updated");
  const text = detail.toLowerCase().startsWith(sourceName.toLowerCase())
    ? detail
    : `${sourceName} ${detail}`;
  const time = new Date(occurredAt)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?[AP]M$/, "");

  return {
    id: [
      entry.context_id,
      entry.when,
      entry.entity_id,
      entry.domain,
      entry.state,
      entry.message,
    ].join(":"),
    occurredAt,
    time,
    text,
    sourceId,
    sourceName,
    domain,
    accent: SECURITY_DOMAINS.has(domain),
  };
}

export async function subscribeHaActivity(
  connection: ActivitySubscribeConnection,
  onEvents: (events: ActivityEvent[]) => void,
  entityIds: readonly string[],
  now = new Date(),
): Promise<() => void> {
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const filteredEntityIds = [...new Set(entityIds.filter((entityId) => entityId !== ""))];
  const message: HaLogbookStreamRequest = {
    type: "logbook/event_stream",
    start_time: start.toISOString(),
  };
  if (filteredEntityIds.length > 0) message.entity_ids = filteredEntityIds;

  const unsubscribe = await connection.subscribeMessage((message) => {
    onEvents(
      message.events
        .map(activityEventFromHa)
        .filter((event): event is ActivityEvent => event !== null),
    );
  }, message);

  return () => {
    void unsubscribe();
  };
}
