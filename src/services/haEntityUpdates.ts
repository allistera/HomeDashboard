import type { Context, HassEntities, HassEntity } from "home-assistant-js-websocket";

// Compressed `subscribe_entities` payloads used by Home Assistant 2022.4+.
// Shape matches home-assistant-js-websocket's internal processEvent handler.
export interface CompressedEntity {
  s: string;
  a?: HassEntity["attributes"];
  c?: string | Context;
  lc: number;
  lu?: number;
}

export interface CompressedEntityChange {
  "+"?: Partial<CompressedEntity>;
  "-"?: { a?: string[] };
}

export interface CompressedEntityUpdates {
  a?: Record<string, CompressedEntity>;
  r?: string[];
  c?: Record<string, CompressedEntityChange>;
}

function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function isContextObject(value: string | Context): value is Context {
  return Object.prototype.hasOwnProperty.call(value, "id");
}

function contextFrom(value: string | Context | undefined, fallback: Context): Context {
  if (value === undefined) return fallback;
  if (isContextObject(value)) {
    return {
      id: value.id,
      parent_id: value.parent_id ?? null,
      user_id: value.user_id ?? null,
    };
  }
  return { id: value, parent_id: null, user_id: null };
}

function entityFromCompressed(entityId: string, compressed: CompressedEntity): HassEntity {
  const lastChanged = isoFromUnix(compressed.lc);
  return {
    entity_id: entityId,
    state: compressed.s,
    attributes: compressed.a ?? {},
    context: contextFrom(compressed.c, { id: entityId, parent_id: null, user_id: null }),
    last_changed: lastChanged,
    last_updated: compressed.lu ? isoFromUnix(compressed.lu) : lastChanged,
  };
}

export function applyCompressedEntityUpdates(
  current: HassEntities,
  updates: CompressedEntityUpdates,
): HassEntities {
  const state: HassEntities = { ...current };

  if (updates.a) {
    for (const entityId in updates.a) {
      state[entityId] = entityFromCompressed(entityId, updates.a[entityId]);
    }
  }

  if (updates.r) {
    for (const entityId of updates.r) {
      delete state[entityId];
    }
  }

  if (updates.c) {
    for (const entityId in updates.c) {
      const entityState = state[entityId];
      if (!entityState) continue;

      const next: HassEntity = { ...entityState, context: { ...entityState.context } };
      const change = updates.c[entityId];
      const toAdd = change["+"];
      const toRemove = change["-"];
      const attributesChanged = Boolean(toAdd?.a || toRemove?.a);
      const attributes = attributesChanged ? { ...entityState.attributes } : entityState.attributes;

      if (toAdd) {
        if (toAdd.s !== undefined) next.state = toAdd.s;
        if (toAdd.c) next.context = contextFrom(toAdd.c, next.context);
        if (toAdd.lc) {
          next.last_updated = next.last_changed = isoFromUnix(toAdd.lc);
        } else if (toAdd.lu) {
          next.last_updated = isoFromUnix(toAdd.lu);
        }
        if (toAdd.a) Object.assign(attributes, toAdd.a);
      }

      if (toRemove?.a) {
        for (const key of toRemove.a) {
          delete attributes[key];
        }
      }

      if (attributesChanged) next.attributes = attributes;
      state[entityId] = next;
    }
  }

  return state;
}
