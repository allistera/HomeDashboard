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

  it("shows room temperatures on both floors and updates them live", async () => {
    const rooms = useRoomsStore();
    const kitchen = rooms.rooms.find((room) => room.id === "kitchen")!;
    const wrapper = mount(FloorsPage);
    try {
      const renderedRooms = () =>
        wrapper.findAll("svg .plan__temp").map((label) => label.attributes("data-room"));
      const kitchenLabel = 'svg .plan__temp[data-room="kitchen"]';
      expect(renderedRooms()).toEqual(["kitchen", "hallway", "living-room"]);
      expect(wrapper.get(kitchenLabel).text()).toBe("21.0°");
      kitchen.temp = null;
      await wrapper.vm.$nextTick();
      expect(wrapper.find(kitchenLabel).exists()).toBe(false);
      kitchen.temp = 22.5;
      await wrapper.vm.$nextTick();
      expect(wrapper.get(kitchenLabel).text()).toBe("22.5°");

      await wrapper.get(".hero__actions button:nth-child(2)").trigger("click");
      expect(renderedRooms()).toEqual(["elsies-room", "bedroom", "jaicobs-room"]);
      expect(wrapper.get('svg .plan__temp[data-room="bedroom"]').text()).toBe("19.5°");
    } finally {
      wrapper.unmount();
    }
  });
});
