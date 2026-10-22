import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import FloorsPage from "@/pages/FloorsPage";
import { useRoomsStore } from "@/stores/rooms";

describe("FloorsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("does not show devices that are not in the home", async () => {
    const wrapper = mount(FloorsPage);

    expect(wrapper.text()).not.toContain("Blinds");
    expect(wrapper.text()).toContain("2 STOREYS · 20 DEVICES");

    await wrapper.get("button:nth-of-type(2)").trigger("click");
    expect(wrapper.text()).not.toContain("Blinds");
  });

  it("prints each room's temperature on its floor", async () => {
    const wrapper = mount(FloorsPage);

    const groundTemps = wrapper.findAll("svg .plan__temp");
    expect(groundTemps.map((t) => t.attributes("data-room"))).toEqual([
      "kitchen",
      "hallway",
      "living-room",
    ]);
    expect(wrapper.get('svg .plan__temp[data-room="kitchen"]').text()).toBe("21.0°");
    expect(wrapper.get('svg .plan__temp[data-room="living-room"]').text()).toBe("21.5°");

    await wrapper.get("button:nth-of-type(2)").trigger("click");
    const firstTemps = wrapper.findAll("svg .plan__temp");
    expect(firstTemps.map((t) => t.attributes("data-room"))).toEqual([
      "elsies-room",
      "bedroom",
      "jaicobs-room",
    ]);
    expect(wrapper.get('svg .plan__temp[data-room="bedroom"]').text()).toBe("19.5°");
  });

  it("leaves the floor blank when a room has no temperature", async () => {
    const rooms = useRoomsStore();
    const kitchen = rooms.rooms.find((r) => r.id === "kitchen");
    if (!kitchen) throw new Error("kitchen seed room missing");
    kitchen.temp = null;

    const wrapper = mount(FloorsPage);

    expect(wrapper.find('svg .plan__temp[data-room="kitchen"]').exists()).toBe(false);
    expect(wrapper.get('svg .plan__temp[data-room="hallway"]').text()).toBe("20.5°");

    kitchen.temp = 22.5;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('svg .plan__temp[data-room="kitchen"]').text()).toBe("22.5°");
  });
});
