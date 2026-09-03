import {
  callService,
  createConnection,
  createLongLivedTokenAuth,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  type Connection,
  type HassEntities,
} from "home-assistant-js-websocket";

import { homePageBindings, watchedEntityIds } from "@/services/haBindings";
import { subscribeHaActivity } from "@/services/haActivity";
import { subscribeWatchedEntities } from "@/services/haSubscribe";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useSettingsStore } from "@/stores/settings";

let connection: Connection | null = null;
let unsubscribeEntities: (() => void) | null = null;
let unsubscribeActivity: (() => void) | null = null;
// Bumped on every connect/disconnect so a slow in-flight connect can detect
// that it was superseded and discard its connection instead of leaking it.
let connectGeneration = 0;

export async function connectHa(onEntities: (entities: HassEntities) => void): Promise<boolean> {
  const settings = useSettingsStore();
  const ha = useHaStore();
  const activity = useActivityStore();
  if (!settings.configured) return false;

  disconnectHa();
  const generation = connectGeneration;
  ha.status = "connecting";
  ha.message = "";

  let conn: Connection;
  try {
    const auth = createLongLivedTokenAuth(settings.url, settings.token);
    conn = await createConnection({ auth });
  } catch (error) {
    if (generation !== connectGeneration) return false;
    ha.status = "error";
    if (error === ERR_INVALID_AUTH) {
      ha.message = "Home Assistant rejected the token.";
    } else if (error === ERR_CANNOT_CONNECT) {
      ha.message =
        "Could not open the WebSocket connection. Check the URL and " +
        "http.cors_allowed_origins on the Home Assistant side.";
    } else {
      ha.message = "Connection failed.";
    }
    return false;
  }

  if (generation !== connectGeneration) {
    conn.close();
    return false;
  }

  connection = conn;
  ha.status = "connected";
  conn.addEventListener("disconnected", () => {
    ha.status = "connecting";
    ha.message = "Connection lost — retrying…";
  });
  conn.addEventListener("ready", () => {
    ha.status = "connected";
    ha.message = "";
  });

  try {
    unsubscribeEntities = await subscribeWatchedEntities(conn, watchedEntityIds(), (entities) => {
      ha.entityCount = Object.keys(entities).length;
      onEntities(entities);
    });
  } catch {
    if (generation !== connectGeneration) return false;
    conn.close();
    connection = null;
    ha.status = "error";
    ha.message = "Connected, but could not subscribe to entity updates.";
    return false;
  }

  activity.beginLoading();
  try {
    unsubscribeActivity = await subscribeHaActivity(
      conn,
      (events) => activity.receive(events),
      homePageBindings.activityEntityIds,
    );
  } catch {
    if (generation === connectGeneration) activity.fail();
  }

  if (generation !== connectGeneration) {
    unsubscribeEntities?.();
    unsubscribeEntities = null;
    unsubscribeActivity?.();
    unsubscribeActivity = null;
    conn.close();
    return false;
  }
  return true;
}

export function disconnectHa(): void {
  const ha = useHaStore();
  const activity = useActivityStore();
  connectGeneration++;
  unsubscribeEntities?.();
  unsubscribeEntities = null;
  unsubscribeActivity?.();
  unsubscribeActivity = null;
  connection?.close();
  connection = null;
  activity.disconnect();
  ha.status = "disconnected";
  ha.message = "";
  ha.entityCount = 0;
}

export function haConnected(): boolean {
  return connection !== null;
}

export function haConnection(): Connection | null {
  return connection;
}

export type ServiceCallResult = "sent" | "failed" | "offline";

export async function haCallService(
  domain: string,
  service: string,
  serviceData?: Record<string, string | number | boolean>,
  target?: { entity_id: string },
): Promise<ServiceCallResult> {
  if (!connection) return "offline";
  try {
    await callService(connection, domain, service, serviceData, target);
    return "sent";
  } catch {
    useHaStore().message = `Service call ${domain}.${service} failed.`;
    return "failed";
  }
}
