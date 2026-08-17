import {
  callService,
  createConnection,
  createLongLivedTokenAuth,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  subscribeEntities,
  type Connection,
  type HassEntities,
} from "home-assistant-js-websocket";

import { useHaStore } from "@/stores/ha";
import { useSettingsStore } from "@/stores/settings";

let connection: Connection | null = null;
let unsubscribe: (() => void) | null = null;

export async function connectHa(onEntities: (entities: HassEntities) => void): Promise<boolean> {
  const settings = useSettingsStore();
  const ha = useHaStore();
  if (!settings.configured) return false;

  disconnectHa();
  ha.status = "connecting";
  ha.message = "";

  try {
    const auth = createLongLivedTokenAuth(settings.url, settings.token);
    connection = await createConnection({ auth });
  } catch (error) {
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

  ha.status = "connected";
  connection.addEventListener("disconnected", () => {
    ha.status = "connecting";
    ha.message = "Connection lost — retrying…";
  });
  connection.addEventListener("ready", () => {
    ha.status = "connected";
    ha.message = "";
  });

  unsubscribe = subscribeEntities(connection, (entities) => {
    ha.entityCount = Object.keys(entities).length;
    onEntities(entities);
  });
  return true;
}

export function disconnectHa(): void {
  const ha = useHaStore();
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

export async function haCallService(
  domain: string,
  service: string,
  serviceData?: Record<string, string | number | boolean>,
  target?: { entity_id: string },
): Promise<void> {
  if (!connection) return;
  try {
    await callService(connection, domain, service, serviceData, target);
  } catch {
    useHaStore().message = `Service call ${domain}.${service} failed.`;
  }
}
