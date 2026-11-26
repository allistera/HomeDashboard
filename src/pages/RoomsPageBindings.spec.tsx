import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

import RoomsPage from "@/pages/RoomsPage";
import { applyEntities } from "@/services/haSync";
import { entity, entityStates } from "@/services/haTestSupport";
import { useActivityStore } from "@/stores/activity";
import { useRoomsStore } from "@/stores/rooms";

describe("RoomsPage Home Assistant inventory", () => {
  let pinia = createPinia();
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });
  it("shows the live state and availability count for allowlisted entities", async () => {
    const temperature = entity("sensor.livingroom_temperature_temperature", "18", {
      friendly_name: "Room temperature",
      unit_of_measurement: "°C",
    });
    const media = entity("media_player.living_room_apple_tv", "unavailable", {
      friendly_name: "Room media",
    });
    const diagnostic = entity("sensor.demo_signal", "50", { friendly_name: "Signal strength" });
    const areas = new Map([
      [temperature.entity_id, "Kitchen"],
      [diagnostic.entity_id, "Living Room"],
    ]);
    applyEntities(entityStates(temperature, media, diagnostic), areas);

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      const devices = wrapper.get('[aria-label="Room devices"]');
      expect(devices.findAll("summary").map((row) => row.get(".row__name").text())).toEqual([
        "Room media",
        "Room temperature",
      ]);
      const summaryStates = () =>
        devices.findAll("summary").map((row) => row.get("span.row__meta").text());
      expect(summaryStates()).toEqual(["unavailable", "18 °C"]);
      expect(wrapper.text()).toContain("2 devices · 1 offline");

      const updatedTemperature = { ...temperature, state: "19" };
      applyEntities(
        entityStates(updatedTemperature, { ...media, state: "playing" }, diagnostic),
        areas,
      );
      await nextTick();
      expect(summaryStates()).toEqual(["playing", "19 °C"]);

      applyEntities(entityStates(updatedTemperature, diagnostic), areas);
      await nextTick();
      expect(devices.text()).toContain("19 °C");
      expect(devices.text()).not.toContain("Room media");
      expect(devices.text()).not.toContain("Signal strength");
      expect(wrapper.text()).toContain("1 devices · 0 offline");
    } finally {
      wrapper.unmount();
    }
  });

  it("keeps area cameras and activity independent of the device allowlist", () => {
    const camera = entity("camera.living_room", "recording", {
      friendly_name: "Living room camera",
    });
    const motion = entity("binary_sensor.other_room_motion", "on");
    applyEntities(
      entityStates(camera, motion),
      new Map([
        [camera.entity_id, "Living Room"],
        [motion.entity_id, "Living Room"],
      ]),
    );
    useActivityStore().receive([
      {
        id: "motion-event",
        occurredAt: 1,
        time: "11:30",
        text: "Motion detected in the living room",
        domain: "binary_sensor",
        sourceId: motion.entity_id,
        sourceName: "Motion",
      },
    ]);

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get('[aria-label="Room devices"]').find("summary").exists()).toBe(false);
      expect(
        wrapper.find('[aria-label="Open Living room camera camera in larger view"]').exists(),
      ).toBe(true);
      expect(wrapper.text()).toContain("Motion detected in the living room");
    } finally {
      wrapper.unmount();
    }
  });

  it("renders the configured outside temperature", () => {
    const rooms = useRoomsStore();
    rooms.setHomeClimateValues(8.4, null, null);

    const wrapper = mount(RoomsPage);

    expect(wrapper.text()).toContain("OUTSIDE 8°");
  });

  it("does not show controls for devices that are not in the home", () => {
    useRoomsStore().selectRoom("kitchen");
    const wrapper = mount(RoomsPage);

    expect(wrapper.text()).not.toContain("Blinds");
    expect(wrapper.find(".brightness-slider").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Relax");
    expect(wrapper.text()).not.toContain("Bright");
  });

  it("controls the selected room's configured media player", async () => {
    const rooms = useRoomsStore();
    const wrapper = mount(RoomsPage);

    expect(rooms.selectedRoom.media?.playing).toBe(true);
    await wrapper.get('[aria-label="Pause"]').trigger("click");

    expect(rooms.selectedRoom.media?.playing).toBe(false);
    expect(wrapper.get('[aria-label="Play"]').text()).toBe("▶");
  });

  it("turns individual lights on and off and adjusts their brightness", async () => {
    const rooms = useRoomsStore();
    const wrapper = mount(RoomsPage);
    const light = rooms.selectedRoom.lights[0]!;
    const power = wrapper.get(`[aria-label="${light.name} power"]`);
    const brightness = wrapper.get<HTMLInputElement>(`[aria-label="${light.name} brightness"]`);

    expect(power.attributes("aria-checked")).toBe("true");
    await power.trigger("click");
    expect(light.level).toBe(0);
    expect(power.attributes("aria-checked")).toBe("false");
    expect(brightness.element.value).toBe("0");

    await power.trigger("click");
    expect(light.level).toBe(70);

    await brightness.setValue(35);
    expect(light.level).toBe(35);
    expect(brightness.attributes("aria-valuetext")).toBe("35%");
    expect(wrapper.text()).toContain("35%");
  });
});
