import {
  callService,
  ERR_INVALID_AUTH,
  subscribeEntityStates,
  type Connection,
  type HassEntityStates,
} from "home-assistant-js-websocket";

import { homePageBindings, type EntityId } from "@/config/homeAssistant";
import { subscribeHaActivity } from "@/services/haActivity";
import { getEntityAreas } from "@/services/haRegistry";
import { applyEntities } from "@/services/haSync";
import { openHaConnection } from "@/services/haTransport";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

let connection: Connection | undefined;
let generation = 0;
let subscriptions: (() => void)[] = [];

export function disconnectHa(): void {
  generation++;
  for (const unsubscribe of subscriptions) unsubscribe();
  subscriptions = [];
  connection?.close();
  connection = undefined;
  useHaStore().$reset();
  useActivityStore().$reset();
  useRoomsStore().$reset();
  useSecurityStore().$reset();
}

export async function connectHa(): Promise<boolean> {
  const settings = useSettingsStore();
  if (!settings.configured) return false;
  disconnectHa();
  const current = generation;
  const ha = useHaStore();
  const activity = useActivityStore();
  ha.status = "connecting";
  activity.beginLoading();
  let client: Connection;
  try {
    client = await openHaConnection(settings.url, settings.token);
  } catch (error) {
    if (current !== generation) return false;
    ha.status = "error";
    activity.fail();
    ha.message =
      error === ERR_INVALID_AUTH
        ? "Home Assistant rejected the token."
        : "Could not open the Home Assistant connection. Check the address and browser access.";
    return false;
  }
  if (current !== generation) {
    client.close();
    return false;
  }

  connection = client;
  let entities: HassEntityStates | undefined;
  let areas = new Map<string, string>();
  let registryRequest = 0;
  const update = () => {
    if (entities && current === generation && client.connected) applyEntities(entities, areas);
  };
  const refreshRegistry = async () => {
    const request = ++registryRequest;
    try {
      const result = await getEntityAreas(client);
      if (generation !== current || request !== registryRequest) return;
      areas = result;
      activity.entityAreas = result;
      ha.areaAssignmentsUnavailable = false;
      update();
    } catch {
      if (generation === current && request === registryRequest)
        ha.areaAssignmentsUnavailable = true;
    }
  };
  const register = async (subscription: Promise<() => void>) => {
    const unsubscribe = await subscription;
    if (current === generation) subscriptions.push(unsubscribe);
    else unsubscribe();
  };

  client.addEventListener("disconnected", () => {
    if (current !== generation) return;
    entities = undefined;
    activity.beginLoading();
    ha.status = "connecting";
    ha.message = "Connection lost. Reconnecting…";
  });
  client.addEventListener("reconnect-error", () => {
    if (current !== generation) return;
    ha.status = "error";
    activity.fail();
    ha.message = "Home Assistant could not reconnect. Check the saved connection.";
  });
  client.addEventListener("ready", () => {
    if (current === generation) void refreshRegistry();
  });

  subscriptions.push(
    subscribeEntityStates(client, (states) => {
      if (current !== generation || !client.connected) return;
      entities = states;
      ha.status = "connected";
      ha.message = "";
      ha.entityCount = Object.keys(states).length;
      update();
    }),
  );

  void refreshRegistry();
  for (const event of [
    "area_registry_updated",
    "device_registry_updated",
    "entity_registry_updated",
  ]) {
    void register(
      client
        .subscribeEvents(() => void refreshRegistry(), event)
        .then((end) => () => {
          void end().catch(() => undefined);
        }),
    ).catch(() => {
      if (current === generation) ha.areaAssignmentsUnavailable = true;
    });
  }
  void register(
    subscribeHaActivity(
      client,
      (events) => {
        if (current === generation) activity.receive(events);
      },
      homePageBindings.activityEntityIds,
    ),
  ).catch(() => {
    if (current === generation) activity.fail();
  });
  return true;
}

export function haConnection(): Connection | undefined {
  return connection?.connected ? connection : undefined;
}

export type ServiceCallResult = "sent" | "failed" | "offline";

export async function haCallService(
  entityId: EntityId,
  service: string,
  data?: Record<string, string | number | boolean | readonly number[]>,
): Promise<ServiceCallResult> {
  const client = haConnection();
  if (!client) return "offline";
  const ha = useHaStore();
  const domain = entityId.split(".")[0];
  try {
    await callService(client, domain, service, data, { entity_id: entityId });
    if (connection === client && client.connected) ha.message = "";
    return "sent";
  } catch {
    if (connection === client && client.connected) {
      ha.message = `Home Assistant could not call ${domain}.${service}.`;
    }
    return "failed";
  }
}
