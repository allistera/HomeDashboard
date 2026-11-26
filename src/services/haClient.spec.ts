import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectHa, disconnectHa } from "@/services/haClient";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

import { HomeAssistantSocket, testLightId } from "@/services/haTestSupport";

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
      expect(rooms.houseTemp).toBe(20.4);
      expect(rooms.rooms.find((room) => room.id === "kitchen")?.temp).toBe(20.5);
      expect(rooms.selectedRoom.lights[0].level).toBe(50);
      expect(rooms.selectedRoom.activityEntityIds).toContain("sensor.example");
      expect(rooms.selectedRoom.devices).toEqual([]);
      expect(useSecurityStore().peopleHome).toBe(1);
      const activity = useActivityStore();
      expect(activity.events[0]?.text).toBe("Living Room Livingroom Light turned on");
      expect(activity.homepageEvents[0]?.text).toBe("Livingroom Light turned on");
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
      target: { entity_id: testLightId },
      service_data: { brightness_pct: 30 },
    });
    expect(rooms.selectedRoom.lights[0].level).toBe(50);
  });

  it("sends colour and white-temperature settings to compatible Home Assistant lights", async () => {
    await connectHa();
    const rooms = useRoomsStore();
    await vi.waitFor(() => expect(rooms.selectedRoom.lights[0].colour?.swatch).toBe("#FF9752"));

    await rooms.setLightColour("living-room", { mode: "colour", hs: [210, 70] });
    await rooms.setLightColour("living-room", { mode: "temperature", kelvin: 6000 });

    const commands = HomeAssistantSocket.active.requests.filter(
      (item) => item.type === "call_service",
    );
    expect(commands).toMatchObject([
      {
        domain: "light",
        service: "turn_on",
        target: { entity_id: testLightId },
        service_data: { hs_color: [210, 70] },
      },
      {
        target: { entity_id: testLightId },
        service_data: { color_temp_kelvin: 6000 },
      },
      {
        target: { entity_id: "light.living_room_livingroom_light_2" },
        service_data: { color_temp_kelvin: 5000 },
      },
    ]);
  });
});
