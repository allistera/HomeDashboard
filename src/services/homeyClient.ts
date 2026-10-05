import { subscribeHomeyDevices } from "@/services/homeySubscribe";
import type {
  CapabilityValue,
  HomeyConnection,
  HomeyDevice,
  HomeyFactory,
} from "@/services/homeyTypes";
import { useActivityStore } from "@/stores/activity";
import { useHomeyStore } from "@/stores/homey";
import { useSettingsStore } from "@/stores/settings";

let connection: HomeyConnection | null = null;
let unsubscribe: (() => void) | null = null;
let devices = new Map<string, HomeyDevice>();
let generation = 0;

async function createHomey(address: string, token: string): Promise<HomeyConnection> {
  // Import only HomeyAPI, not all Athom cloud clients, and load it on demand.
  const { default: HomeyAPI } = await import("homey-api/lib/HomeyAPI/HomeyAPI.js");
  return HomeyAPI.createLocalAPI({ address, token, debug: null });
}

export async function connectHomey(
  onDevices: (devices: Map<string, HomeyDevice>) => void,
  factory: HomeyFactory = createHomey,
): Promise<boolean> {
  const settings = useSettingsStore();
  if (!settings.configured) return false;
  disconnectHomey();
  const current = generation;
  const state = useHomeyStore();
  const activity = useActivityStore();
  state.status = "connecting";
  activity.beginLoading();
  onDevices(new Map());
  let opened: HomeyConnection | null = null;
  let stop: (() => void) | null = null;
  try {
    opened = await factory(settings.url, settings.token);
    if (current !== generation) {
      opened.destroy();
      return false;
    }
    const active = opened;
    let subscribed = false;
    active.on("disconnect", () => {
      if (current !== generation) return;
      state.status = "connecting";
      state.message = "Connection lost — retrying…";
      activity.disconnect();
      onDevices(new Map());
    });
    const ready = () => {
      if (current !== generation || !subscribed) return;
      state.status = "connected";
      state.message = "";
      activity.receive([]);
    };
    active.on("connect", ready);
    active.on("reconnect", ready);
    await active.connect();
    stop = await subscribeHomeyDevices(
      active,
      (snapshot) => {
        if (current !== generation) return;
        devices = snapshot;
        state.deviceCount = snapshot.size;
        onDevices(snapshot);
      },
      (events) => {
        if (current === generation) activity.receive(events);
      },
    );
    if (current !== generation) {
      stop();
      active.destroy();
      return false;
    }
    connection = active;
    unsubscribe = stop;
    subscribed = true;
    ready();
    return true;
  } catch {
    stop?.();
    opened?.destroy();
    if (current === generation) {
      devices.clear();
      state.deviceCount = 0;
      state.status = "error";
      state.message =
        "Could not connect to Homey. Check the address, personal access token, and device permissions.";
      activity.fail();
    }
    return false;
  }
}

export function disconnectHomey(): void {
  generation++;
  unsubscribe?.();
  unsubscribe = null;
  connection?.destroy();
  connection = null;
  devices.clear();
  const state = useHomeyStore();
  state.status = "disconnected";
  state.message = "";
  state.deviceCount = 0;
  useActivityStore().disconnect();
}

export type CommandResult = "sent" | "failed" | "offline";

export async function setHomeyCapability(
  deviceId: string,
  capabilityId: string,
  value: Exclude<CapabilityValue, null>,
): Promise<CommandResult> {
  if (!connection || useHomeyStore().status !== "connected") return "offline";
  const device = devices.get(deviceId);
  if (
    !device?.available ||
    !device.capabilities.includes(capabilityId) ||
    device.capabilitiesObj[capabilityId]?.setable === false
  )
    return "failed";
  try {
    await device.setCapabilityValue({ capabilityId, value });
    return "sent";
  } catch {
    useHomeyStore().message = `Homey could not update ${device.name}.`;
    return "failed";
  }
}

export async function setHomeyLight(deviceId: string, level: number): Promise<CommandResult> {
  const device = devices.get(deviceId);
  if (level <= 0) return setHomeyCapability(deviceId, "onoff", false);
  const on = await setHomeyCapability(deviceId, "onoff", true);
  if (on !== "sent" || !device?.capabilities.includes("dim")) return on;
  return setHomeyCapability(deviceId, "dim", Math.min(100, Math.max(0, level)) / 100);
}
