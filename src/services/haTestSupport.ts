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
const kitchenTemperature = "sensor.kitchen_temperature_temperature";
const indoorAverage = "sensor.average_indoor_temperature";
const gardenGateTemperature = "sensor.garden_gate_temperature";

interface Request {
  type: string;
  id: number;
  access_token?: string;
  domain?: string;
  service?: string;
  service_data?: { brightness_pct?: number; hs_color?: number[]; color_temp_kelvin?: number };
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
                supported_color_modes: ["color_temp", "xy"],
                min_color_temp_kelvin: 2000,
                max_color_temp_kelvin: 6535,
                color_mode: "xy",
                hs_color: [24, 68],
                rgb_color: [255, 151, 82],
              },
              c: "light",
              lc: 1795626720,
            },
            "light.living_room_livingroom_light_2": {
              s: "off",
              a: { supported_color_modes: ["color_temp"], max_color_temp_kelvin: 5000 },
              c: "light",
              lc: 1795626720,
            },
            [kitchenTemperature]: {
              s: "20.5",
              a: { unit_of_measurement: "°C" },
              c: "temperature",
              lc: 1795626720,
            },
            [testKitchenLightId]: {
              s: "off",
              a: { friendly_name: "Kitchen Light" },
              c: "kitchen-switch",
              lc: 1795626720,
            },
            [indoorAverage]: {
              s: "20.4",
              a: { unit_of_measurement: "°C" },
              c: "temperature",
              lc: 1795626720,
            },
            [gardenGateTemperature]: {
              s: "8.4",
              a: { unit_of_measurement: "°C" },
              c: "garden-gate",
              lc: 1795626720,
            },
            "weather.home": {
              s: "cloudy",
              a: { temperature: 12 },
              c: "weather",
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
            "alarm_control_panel.alarmo": {
              s: "disarmed",
              a: { friendly_name: "Alarmo", supported_features: 11 },
              c: "alarmo",
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
        result({
          entities: [
            { ei: "sensor.example", di: "device" },
            { ei: testLightId, di: "device" },
          ],
        });
        break;
      case "logbook/event_stream":
        result(null);
        event({
          events: [
            {
              when: 1795626720,
              name: "Living Room Livingroom Light",
              entity_id: testLightId,
              state: "on",
            },
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

  changeAlarm(state: string): void {
    this.receive({
      type: "event",
      id: this.subscription,
      event: { c: { "alarm_control_panel.alarmo": { "+": { s: state } } } },
    });
  }

  changeOutdoorTemperature(state: string): void {
    this.receive({
      type: "event",
      id: this.subscription,
      event: { c: { [gardenGateTemperature]: { "+": { s: state } } } },
    });
  }

  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}
