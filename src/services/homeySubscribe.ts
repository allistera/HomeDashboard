import { watchedDeviceIds } from "@/services/homeyBindings/homeyGlobalBindings";
import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { activityEventFromHomey, type ActivityEvent } from "@/services/homeyActivity";
import type { CapabilityListener, HomeyConnection, HomeyDevice } from "@/services/homeyTypes";

export async function subscribeHomeyDevices(
  connection: HomeyConnection,
  onDevices: (devices: Map<string, HomeyDevice>) => void,
  onEvents: (events: ActivityEvent[]) => void,
): Promise<() => void> {
  const devices = new Map<string, HomeyDevice>();
  const listeners = new Map<string, CapabilityListener[]>();
  const watched = new Set(watchedDeviceIds());
  const roomZones = new Set(Object.values(homePageBindings.roomZoneIds));
  let stopped = false;
  const remove = (id: string) => {
    for (const listener of listeners.get(id) ?? []) listener.destroy();
    listeners.delete(id);
    devices.delete(id);
  };
  const attach = async (device: HomeyDevice) => {
    if (stopped) return;
    remove(device.id);
    devices.set(device.id, device);
    // Room property values need capability updates even without bound controls.
    if (!watched.has(device.id) && !roomZones.has(device.zone)) return;
    const subscriptions: CapabilityListener[] = [];
    listeners.set(device.id, subscriptions);
    for (const capabilityId of device.capabilities) {
      const subscription = device.makeCapabilityInstance(capabilityId, (value, capability) => {
        if (stopped || devices.get(device.id) !== device) return;
        const property = device.capabilitiesObj[capabilityId];
        if (property) {
          property.value = value;
          property.lastUpdated = capability.lastChanged;
        }
        onDevices(new Map(devices));
        if (homePageBindings.activityDeviceIds.includes(device.id)) {
          const event = activityEventFromHomey(
            device,
            capabilityId,
            value,
            capability.lastChanged ?? new Date(),
          );
          if (event) onEvents([event]);
        }
      });
      subscriptions.push(subscription);
    }
    // makeCapabilityInstance starts a connection in the background; explicitly
    // await it so connection failures cannot be reported as a live subscription.
    await device.connect();
  };
  const update = (device: HomeyDevice) => {
    if (stopped) return;
    void attach(device)
      .then(() => {
        if (!stopped) onDevices(new Map(devices));
      })
      .catch(() => {
        if (!stopped && devices.get(device.id) === device) {
          remove(device.id);
          onDevices(new Map(devices));
        }
      });
  };
  const deleted = (device: HomeyDevice) => {
    if (stopped) return;
    remove(device.id);
    onDevices(new Map(devices));
  };
  const cleanup = () => {
    stopped = true;
    connection.devices.off("device.create", update);
    connection.devices.off("device.update", update);
    connection.devices.off("device.delete", deleted);
    for (const id of listeners.keys()) remove(id);
  };
  try {
    await connection.devices.connect();
    connection.devices.on("device.create", update);
    connection.devices.on("device.update", update);
    connection.devices.on("device.delete", deleted);
    const inventory = await connection.devices.getDevices({ $cache: false });
    await Promise.all(Object.values(inventory).map(attach));
    onDevices(new Map(devices));
    onEvents([]);
    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
}
