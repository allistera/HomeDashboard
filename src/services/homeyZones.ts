import type { HomeyConnection, HomeyZone } from "@/services/homeyTypes";
import { useZonesStore } from "@/stores/zones";

export async function subscribeHomeyZones(
  connection: HomeyConnection,
  isCurrent: () => boolean = () => true,
): Promise<() => void> {
  const store = useZonesStore();
  let stopped = false;
  let revision = 0;
  let requestId = 0;
  const update = (zone: HomeyZone) => {
    if (stopped || !isCurrent()) return;
    revision++;
    store.zones[zone.id] = {
      id: zone.id,
      active: zone.active ?? store.zones[zone.id]?.active,
      activeLastUpdated:
        zone.activeLastUpdated === undefined
          ? store.zones[zone.id]?.activeLastUpdated
          : zone.activeLastUpdated,
    };
  };
  const deleted = (zone: HomeyZone) => {
    if (stopped || !isCurrent()) return;
    revision++;
    delete store.zones[zone.id];
  };
  const refresh = async (): Promise<void> => {
    const current = ++requestId;
    const initialRevision = revision;
    try {
      const zones = await connection.zones.getZones({ $cache: false });
      if (stopped || !isCurrent()) return;
      if (current !== requestId) return;
      if (initialRevision !== revision) return refresh();
      store.zones = Object.fromEntries(
        Object.values(zones).map((zone) => [
          zone.id,
          {
            id: zone.id,
            active: zone.active,
            activeLastUpdated: zone.activeLastUpdated,
          },
        ]),
      );
      store.unavailable = false;
    } catch {
      if (stopped || !isCurrent() || current !== requestId) return;
      store.zones = {};
      store.unavailable = true;
    }
  };
  const cleanup = () => {
    stopped = true;
    connection.zones.off("zone.create", update);
    connection.zones.off("zone.update", update);
    connection.zones.off("zone.delete", deleted);
  };
  connection.zones.on("zone.create", update);
  connection.zones.on("zone.update", update);
  connection.zones.on("zone.delete", deleted);
  connection.on("disconnect", () => {
    if (stopped || !isCurrent()) return;
    requestId++;
    store.zones = {};
  });
  connection.on("connect", () => {
    if (!stopped && isCurrent()) void refresh();
  });
  connection.on("reconnect", () => {
    if (!stopped && isCurrent()) void refresh();
  });
  try {
    await connection.zones.connect();
    await refresh();
  } catch {
    if (!stopped && isCurrent()) {
      store.zones = {};
      store.unavailable = true;
    }
  }
  return cleanup;
}
