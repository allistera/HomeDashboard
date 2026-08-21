import {
  callService,
  createConnection,
  createLongLivedTokenAuth,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  type Connection,
  type HassEntities,
} from "home-assistant-js-websocket";

import { watchedEntityIds } from "@/services/haBindings";
import { subscribeWatchedEntities } from "@/services/haSubscribe";
import { useHaStore } from "@/stores/ha";
import { useSettingsStore } from "@/stores/settings";

let connection: Connection | null = null;
let unsubscribe: (() => void) | null = null;
// Bumped on every connect/disconnect so a slow in-flight connect can detect
// that it was superseded and discard its connection instead of leaking it.
let connectGeneration = 0;

export async function connectHa(onEntities: (entities: HassEntities) => void): Promise<boolean> {
  const settings = useSettingsStore();
  const ha = useHaStore();
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
    unsubscribe = await subscribeWatchedEntities(conn, watchedEntityIds(), (entities) => {
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

  if (generation !== connectGeneration) {
    unsubscribe?.();
    unsubscribe = null;
    conn.close();
    return false;
  }
  return true;
}

export function disconnectHa(): void {
  const ha = useHaStore();
  connectGeneration++;
  unsubscribe?.();
  unsubscribe = null;
  connection?.close();
  connection = null;
  ha.status = "disconnected";
  ha.message = "";
  ha.entityCount = 0;
}

export function haConnected(): boolean {
  return connection !== null;
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
