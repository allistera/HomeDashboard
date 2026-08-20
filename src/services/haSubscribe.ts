import type { HassEntities } from "home-assistant-js-websocket";

import {
  applyCompressedEntityUpdates,
  type CompressedEntityUpdates,
} from "@/services/haEntityUpdates";

export interface EntitySubscribeConnection {
  subscribeMessage(
    callback: (updates: CompressedEntityUpdates) => void,
    message: { type: "subscribe_entities"; entity_ids: string[] },
  ): Promise<() => void | Promise<void>>;
}

export async function subscribeWatchedEntities(
  connection: EntitySubscribeConnection,
  entityIds: string[],
  onEntities: (entities: HassEntities) => void,
): Promise<() => void> {
  const ids = [...new Set(entityIds.filter((id) => id !== ""))];
  let entities: HassEntities = {};

  const unsubscribe = await connection.subscribeMessage(
    (updates) => {
      entities = applyCompressedEntityUpdates(entities, updates);
      onEntities(entities);
    },
    { type: "subscribe_entities", entity_ids: ids },
  );

  return () => {
    void unsubscribe();
  };
}
