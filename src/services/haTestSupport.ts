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

export const testLightId = "light.living_room_livingroom_light";
export const testKitchenLightId = "switch.kitchen_light";
const temperature = "sensor.kitchen_temperature_temperature";

interface Request {
  type: string;
  id: number;
  access_token?: string;
  domain?: string;
  service?: string;
  service_data?: { brightness_pct?: number };
  target?: { entity_id: string };
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export class HomeAssistantSocket extends EventTarget {
  static active: HomeAssistantSocket;
  readonly OPEN = 1;
  readyState = this.OPEN;
  requests: Request[] = [];
  rejectAction = false;
  url: string;
  private subscription = 0;

  constructor(url: string) {
    super();
    this.url = url;
    HomeAssistantSocket.active = this;
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  private receive(payload: Json): void {
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(payload) }));
    });
  }

  send(message: string): void {
    const request: Request = JSON.parse(message);
    this.requests.push(request);
    const result = (value: Json) =>
      this.receive({
        type: "result",
        id: request.id,
        success: true,
        result: value,
      });
    const event = (value: Json) => this.receive({ type: "event", id: request.id, event: value });
    switch (request.type) {
      case "auth":
        if (request.access_token === "bad-token") {
          this.receive({ type: "auth_invalid", message: "Invalid token" });
        } else {
          this.receive({ type: "auth_ok", ha_version: "2026.11.0" });
        }
        break;
      case "subscribe_entities":
        this.subscription = request.id;
        result(null);
        event({
          a: {
            [testLightId]: {
              s: "on",
              a: {
                friendly_name: "Living Room Light",
                brightness: 128,
                supported_color_modes: ["brightness"],
              },
              c: "light",
              lc: 1795626720,
            },
            [testKitchenLightId]: {
              s: "off",
              a: { friendly_name: "Kitchen Light" },
              lc: 1795626720,
            },
            [temperature]: {
              s: "20.5",
              a: { unit_of_measurement: "°C" },
              c: "temperature",
              lc: 1795626720,
            },
            "sensor.example": {
              s: "21",
              a: { friendly_name: "Additional sensor" },
              c: "sensor",
              lc: 1795626720,
            },
            "person.allister_antosik": {
              s: "home",
              a: { friendly_name: "Allister" },
              c: "person",
              lc: 1795626720,
            },
          },
        });
        break;
      case "config/area_registry/list":
        result([{ area_id: "living_room", name: "Living Room" }]);
        break;
      case "config/device_registry/list":
        result([{ id: "device", area_id: "living_room" }]);
        break;
      case "config/entity_registry/list_for_display":
        result({ entities: [{ ei: "sensor.example", di: "device" }] });
        break;
      case "logbook/event_stream":
        result(null);
        event({
          events: [
            { when: 1795626720, name: "Living Room Light", entity_id: testLightId, state: "on" },
          ],
        });
        break;
      case "call_service":
        if (this.rejectAction) {
          this.receive({
            type: "result",
            id: request.id,
            success: false,
            error: { code: "unauthorized", message: "denied" },
          });
        } else {
          result({});
        }
        break;
      default:
        result(null);
    }
  }

  changeLight(state: string): void {
    this.receive({
      type: "event",
      id: this.subscription,
      event: { c: { [testLightId]: { "+": { s: state } } } },
    });
  }

  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}
