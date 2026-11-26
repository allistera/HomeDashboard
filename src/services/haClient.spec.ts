import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectHa, disconnectHa } from "@/services/haClient";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

const light = "light.living_room_livingroom_light";
const temperature = "sensor.kitchen_temperature_temperature";

interface Request {
  type: string;
  id: number;
  domain?: string;
  service?: string;
  service_data?: { brightness_pct?: number };
  target?: { entity_id: string };
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

class HomeAssistantSocket extends EventTarget {
  static active: HomeAssistantSocket;
  static OPEN = 1;
  readyState = HomeAssistantSocket.OPEN;
  requests: Request[] = [];
  rejectAction = false;
  private subscription = 0;

  constructor() {
    super();
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
        this.receive({ type: "auth_ok", ha_version: "2026.11.0" });
        break;
      case "subscribe_entities":
        this.subscription = request.id;
        result(null);
        event({
          a: {
            [light]: {
              s: "on",
              a: {
                friendly_name: "Living Room Light",
                brightness: 128,
                supported_color_modes: ["brightness"],
              },
              c: "light",
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
          events: [{ when: 1795626720, name: "Living Room Light", entity_id: light, state: "on" }],
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
      event: { c: { [light]: { "+": { s: state } } } },
    });
  }

  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}

describe("Home Assistant connection", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.stubGlobal("WebSocket", HomeAssistantSocket);
    const settings = useSettingsStore();
    settings.url = "https://ha.example";
    settings.token = "fixture-token";
  });

  afterEach(() => {
    disconnectHa();
    vi.unstubAllGlobals();
  });

  it("hydrates rooms, presence and logbook, then applies a live state update", async () => {
    expect(await connectHa()).toBe(true);
    const ha = useHaStore();
    const rooms = useRoomsStore();
    await vi.waitFor(() => {
      expect(ha.status).toBe("connected");
      expect(rooms.houseTemp).toBe(20.5);
      expect(rooms.selectedRoom.lights[0].level).toBe(50);
      expect(rooms.selectedRoom.devices?.map((item) => item.name)).toContain("Additional sensor");
      expect(useSecurityStore().peopleHome).toBe(1);
      expect(useActivityStore().events[0]?.text).toBe("Living Room Light turned on");
    });

    HomeAssistantSocket.active.changeLight("off");
    await vi.waitFor(() => expect(rooms.selectedRoom.lights[0].level).toBe(0));

    disconnectHa();
    expect(ha.status).toBe("disconnected");
    expect(rooms.hasLiveData).toBe(false);
    expect(useActivityStore().status).toBe("offline");
  });

  it("uses the light entity as an action target and rolls back a rejected command", async () => {
    await connectHa();
    const rooms = useRoomsStore();
    await vi.waitFor(() => expect(rooms.hasLiveData).toBe(true));
    const socket = HomeAssistantSocket.active;
    socket.rejectAction = true;
    rooms.setLightLevel("living-room", "livingroom-light", 30);
    await vi.waitFor(() => expect(useHaStore().message).toContain("light.turn_on"));
    expect(socket.requests.find((request) => request.type === "call_service")).toMatchObject({
      domain: "light",
      service: "turn_on",
      target: { entity_id: light },
      service_data: { brightness_pct: 30 },
    });
    expect(rooms.selectedRoom.lights[0].level).toBe(50);
  });
});
