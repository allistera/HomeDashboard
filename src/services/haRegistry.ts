import type { Connection } from "home-assistant-js-websocket";

interface AreaEntry {
  area_id: string;
  name: string;
}

interface DeviceEntry {
  id: string;
  area_id: string | null;
}

interface DisplayEntity {
  ei: string;
  ai?: string;
  di?: string;
  hb?: boolean;
}

export async function getEntityAreas(connection: Connection): Promise<Map<string, string>> {
  const [areas, devices, registry] = await Promise.all([
    connection.sendMessagePromise<AreaEntry[]>({ type: "config/area_registry/list" }),
    connection.sendMessagePromise<DeviceEntry[]>({ type: "config/device_registry/list" }),
    connection.sendMessagePromise<{ entities: DisplayEntity[] }>({
      type: "config/entity_registry/list_for_display",
    }),
  ]);
  const areaNames = new Map(areas.map((area) => [area.area_id, area.name]));
  const deviceAreas = new Map(devices.map((device) => [device.id, device.area_id]));
  const byEntity = new Map<string, string>();
  for (const entity of registry.entities) {
    if (entity.hb) continue;
    const area = entity.ai ?? deviceAreas.get(entity.di ?? "");
    const name = area && areaNames.get(area);
    if (name) byEntity.set(entity.ei, name);
  }
  return byEntity;
}
