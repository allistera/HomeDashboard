import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectHa, disconnectHa } from "@/services/haClient";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

import { HomeAssistantSocket, testKitchenLightId, testLightId } from "@/services/haTestSupport";

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
      expect(rooms.selectedRoom.activityEntityIds).toContain("sensor.example");
      expect(rooms.selectedRoom.devices?.map((item) => item.name)).toEqual(["Living Room Light"]);
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

  it("sends switch actions for the Kitchen light without a brightness value", async () => {
    await connectHa();
    const rooms = useRoomsStore();
    rooms.selectRoom("kitchen");
    await vi.waitFor(() => {
      expect(rooms.selectedRoom.lights[0]).toMatchObject({
        id: "kitchen-light",
        dimmable: false,
        level: 0,
      });
    });

    rooms.setRoomLights("kitchen", true);
    rooms.setLightPower("kitchen", "kitchen-light", false);
    const requests = HomeAssistantSocket.active.requests.filter(
      (request) => request.type === "call_service",
    );
    expect(requests).toMatchObject([
      { domain: "switch", service: "turn_on", target: { entity_id: testKitchenLightId } },
      { domain: "switch", service: "turn_off", target: { entity_id: testKitchenLightId } },
    ]);
    expect(requests[0].service_data?.brightness_pct).toBeUndefined();
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
      target: { entity_id: testLightId },
      service_data: { brightness_pct: 30 },
    });
    expect(rooms.selectedRoom.lights[0].level).toBe(50);
  });
});
