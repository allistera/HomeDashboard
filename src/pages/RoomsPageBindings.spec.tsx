import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

import RoomsPage from "@/pages/RoomsPage";
import { applyEntities } from "@/services/haSync";
import { useRoomsStore } from "@/stores/rooms";
import { entity, entityStates } from "@/services/haTestSupport";

describe("RoomsPage Home Assistant inventory", () => {
  let pinia = createPinia();
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });
  it("displays entities in the room, with current state and updated membership", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const sensor = entity("sensor.demo_temperature", "18", {
      friendly_name: "Room temperature",
      unit_of_measurement: "°C",
    });
    const other = entity("sensor.demo_humidity", "50", { friendly_name: "Other humidity" });
    const access = new Map([
      [sensor.entity_id, "Living Room"],
      [other.entity_id, "Kitchen"],
    ]);
    applyEntities(entityStates(sensor, other), access);

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.text()).toContain("Room temperature");
      expect(wrapper.text()).not.toContain("Other humidity");
      const details = wrapper
        .findAll("summary")
        .find((summary) => summary.text().includes("Room temperature"));
      await details?.trigger("click");
      expect(wrapper.text()).toContain("18 °C");

      access.set(sensor.entity_id, "Kitchen");
      access.set(other.entity_id, "Living Room");
      applyEntities(entityStates(sensor, other), access);
      await nextTick();
      expect(wrapper.text()).not.toContain("Room temperature");
      expect(wrapper.text()).toContain("Other humidity");
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
