import type { HassEntityState, HassEntityStates } from "home-assistant-js-websocket";

export function entity(
  entityId: string,
  state: string,
  attributes: HassEntityState["attributes"] = {},
): HassEntityState {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: "2026-11-25T17:12:00Z",
    last_updated: "2026-11-25T17:12:00Z",
    context: { id: "state", parent_id: null, user_id: null },
  };
}

export function entityStates(...entities: HassEntityState[]): HassEntityStates {
  return Object.fromEntries(entities.map((state) => [state.entity_id, state]));
}
