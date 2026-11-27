import { haConnection } from "@/services/haClient";
import { useSettingsStore } from "@/stores/settings";

export async function requestHaHlsUrl(entityId: string): Promise<string | null> {
  const connection = haConnection();
  if (!connection) return null;

  const baseUrl = useSettingsStore().url;
  const stream = await connection.sendMessagePromise<{ url: string }>({
    type: "camera/stream",
    entity_id: entityId,
    format: "hls",
  });
  return new URL(stream.url, baseUrl).href;
}
