import { markRaw } from "vue";

import { applyDevices } from "@/services/homeySync";
import { subscribeHomeyDevices } from "@/services/homeySubscribe";
import { subscribeHomeyZones } from "@/services/homeyZones";
import { useZonesStore } from "@/stores/zones";
import type { HomeyConnection, HomeyDevice, HomeyFactory } from "@/services/homeyTypes";
import { useActivityStore } from "@/stores/activity";
import { useHomeyStore } from "@/stores/homey";
import { useSettingsStore } from "@/stores/settings";
import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import type { HomeyTransport } from "@/services/homeyTransport";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

async function createHomey(address: string, token: string): Promise<HomeyConnection> {
  // Import only HomeyAPI, not all Athom cloud clients, and load it on demand.
  const { default: HomeyAPI } = await import("homey-api/lib/HomeyAPI/HomeyAPI.js");
  return HomeyAPI.createLocalAPI({ address, token, debug: null });
}

export async function connectHomey(factory: HomeyFactory = createHomey): Promise<boolean> {
  const session = useHomeyStore().transport;
  const rooms = useRoomsStore();
  const security = useSecurityStore();
  const zones = useZonesStore();
  const onDevices = (devices: Map<string, HomeyDevice>) => applyDevices(devices, rooms, security);
  const settings = useSettingsStore();
  if (!settings.configured) return false;
  disconnectHomey();
  const current = session.generation;
  const state = useHomeyStore();
  const activity = useActivityStore();
  session.status = "connecting";
  activity.beginLoading();
  onDevices(new Map());
  let opened: HomeyConnection | null = null;
  let stop: (() => void) | null = null;
  let stopZones: (() => void) | null = null;
  let stopWeather: (() => void) | null = null;
  try {
    opened = await factory(settings.url, settings.token);
    if (current !== session.generation) {
      opened.destroy();
      return false;
    }
    const active = opened;
    let subscribed = false;
    active.on("disconnect", () => {
      if (current !== session.generation) return;
      session.status = "connecting";
      session.message = "Connection lost — retrying…";
      activity.disconnect();
      onDevices(new Map());
    });
    const ready = () => {
      if (current !== session.generation || !subscribed) return;
      session.status = "connected";
      session.message = "";
      activity.receive([]);
      void refreshOutsideTemperature(active, current, session, rooms);
    };
    active.on("connect", ready);
    active.on("reconnect", ready);
    active.on("disconnect", () => {
      if (current === session.generation) rooms.setOutsideTemperature(null);
    });
    if (active.flowtoken) {
      const updateWeather = (token: { id: string }) => {
        if (token.id === homePageBindings.outsideTemperatureTokenId)
          void refreshOutsideTemperature(active, current, session, rooms);
      };
      active.flowtoken.on("flowtoken.update", updateWeather);
      stopWeather = () => active?.flowtoken?.off("flowtoken.update", updateWeather);
    }
    await active.connect();
    try {
      await active.flowtoken?.connect();
    } catch {
      // Weather subscriptions are optional; keep device controls available.
    }
    stop = await subscribeHomeyDevices(
      active,
      (snapshot) => {
        if (current !== session.generation) return;
        session.devices = markRaw(snapshot);
        state.deviceCount = snapshot.size;
        onDevices(snapshot);
      },
      (events) => {
        if (current === session.generation) activity.receive(events);
      },
    );
    if (current !== session.generation) {
      stopWeather?.();
      stop();
      active.destroy();
      return false;
    }
    stopZones = await subscribeHomeyZones(active, () => current === session.generation, zones);
    if (current !== session.generation) {
      stopWeather?.();
      stopZones();
      stop();
      active.destroy();
      return false;
    }
    session.connection = markRaw(active);
    const stopDevices = stop;
    const stopZoneUpdates = stopZones;
    session.unsubscribe = () => {
      stopDevices();
      stopZoneUpdates();
      stopWeather?.();
    };
    subscribed = true;
    ready();
    return true;
  } catch {
    stopZones?.();
    stop?.();
    stopWeather?.();
    opened?.destroy();
    if (current === session.generation) {
      session.devices.clear();
      state.deviceCount = 0;
      session.status = "error";
      session.message =
        "Could not connect to Homey. Check the address, personal access token, and device permissions.";
      activity.fail();
    }
    return false;
  }
}

export function disconnectHomey(): void {
  const session = useHomeyStore().transport;
  session.generation++;
  session.unsubscribe?.();
  session.unsubscribe = null;
  session.connection?.destroy();
  session.connection = null;
  session.devices.clear();
  if (useRoomsStore().mode === "live") applyDevices(new Map());
  useZonesStore().$reset();
  useRoomsStore().setOutsideTemperature(null);
  const security = useSecurityStore();
  if (security.dataFromHomey) security.people = [];
  const state = useHomeyStore();
  session.status = "disconnected";
  session.message = "";
  state.deviceCount = 0;
  useActivityStore().disconnect();
}

async function refreshOutsideTemperature(
  homey: HomeyConnection,
  current: number,
  session: HomeyTransport,
  rooms: ReturnType<typeof useRoomsStore>,
): Promise<void> {
  if (!homey.flowtoken) return;
  try {
    const value = await homey.flowtoken.getFlowTokenValue({
      id: homePageBindings.outsideTemperatureTokenId,
    });
    if (current !== session.generation || session.status !== "connected") return;
    const reading = String(value ?? "").trim();
    const temperature = reading === "" ? NaN : Number(reading);
    rooms.setOutsideTemperature(Number.isFinite(temperature) ? temperature : null);
  } catch {
    // Flow-token read permission is optional; Homey device controls remain connected.
    if (current === session.generation && session.status === "connected")
      rooms.setOutsideTemperature(null);
  }
}

export { setHomeyCapability, setHomeyLight, homeyCameraVideo } from "@/services/homeyCommands";
