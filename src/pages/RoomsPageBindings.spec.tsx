import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import RoomsPage from "@/pages/RoomsPage";
import { useRoomsStore } from "@/stores/rooms";

describe("RoomsPage bindings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the configured outside temperature", () => {
    const rooms = useRoomsStore();
    rooms.setHomeClimateValues(8.4, null, null);

    const wrapper = mount(RoomsPage);

    expect(wrapper.text()).toContain("OUTSIDE 8°");
  });

  it("does not show controls for devices that are not in the home", () => {
    const wrapper = mount(RoomsPage);

    expect(wrapper.text()).not.toContain("Blinds");
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
