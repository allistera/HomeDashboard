import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import HomePage from "@/pages/HomePage";
import { activityEventFromHa } from "@/services/haActivity";
import { applyEntities } from "@/services/haSync";
import { entity, entityStates, testLightId } from "@/services/haTestSupport";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useRoomsStore } from "@/stores/rooms";

describe("HomePage headline", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("shows the current Home Assistant connection in the headline", async () => {
    const ha = useHaStore();
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get("h1").text()).toBe("Home Assistant is not connected.");
      ha.status = "connecting";
      await nextTick();
      expect(wrapper.get("h1").text()).toBe("Connecting to Home Assistant…");
      ha.status = "error";
      await nextTick();
      expect(wrapper.get("h1").text()).toBe("Home Assistant connection failed.");
    } finally {
      wrapper.unmount();
    }
  });

  it("updates the headline on live door and light changes without reloading", async () => {
    const frontDoor = (state: string) =>
      entity("binary_sensor.front_door_contact", state, { friendly_name: "Front door contact" });
    const backDoor = (state: string) => entity("binary_sensor.back_door_contact", state);
    const update = (front: string, back: string, light: string) =>
      applyEntities(entityStates(frontDoor(front), backDoor(back), entity(testLightId, light)));

    useHaStore().status = "connected";
    update("off", "off", "on");
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get("h1").text()).toBe("Living room lights are on.");
      update("on", "unavailable", "on");
      await nextTick();
      expect(wrapper.get("h1").text()).toBe("Front door is open.");
      update("off", "unavailable", "off");
      await nextTick();
      expect(wrapper.get("h1").text()).toBe("Door status unavailable.");
      update("off", "off", "off");
      await nextTick();
      expect(wrapper.get("h1").text()).toBe("All available lights are off.");
    } finally {
      wrapper.unmount();
    }
  });

  it("labels the homepage night button 'Get Jaicob'", () => {
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    expect(wrapper.get(".btn--primary").text()).toBe("Get Jaicob");
    expect(wrapper.findAll(".hero__actions button").map((button) => button.text())).toContain(
      "Night Time",
    );
  });

  it("shows only complete Home Assistant activity rows that fit", async () => {
    const activity = useActivityStore();
    const bounds = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (this.classList.contains("events--fit")) return new DOMRect(0, 0, 250, 100);
        const index = Array.from(this.parentElement?.children ?? []).indexOf(this);
        return new DOMRect(0, index * 44, 250, 44);
      });
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get(".events").text()).toBe("Connect Home Assistant to see activity.");
      activity.beginLoading();
      await nextTick();
      expect(wrapper.get(".events").text()).toBe("Loading Home Assistant activity…");

      const hallwayLight = "light.downstairs_hallway_downstairs_hallway_light";
      const sources = [
        { entity_id: hallwayLight, name: "Downstairs Hallway Hallway Light" },
        { entity_id: "media_player.living_room_apple_tv", name: "Apple TV" },
        { entity_id: "switch.kitchen_light", name: "Kitchen Light" },
      ];
      activity.receive(
        sources.map((source, index) =>
          activityEventFromHa({ ...source, when: 1_796_000_000 - index, state: "on" })!,
        ),
      );
      activity.entityAreas.set(hallwayLight, "Downstairs Hallway");
      await nextTick();
      expect(
        wrapper.get(".homepage-activity").element.previousElementSibling?.textContent?.trim(),
      ).toBe("Activity");
      const rows = wrapper.findAll(".events .event:not(.event--overflow) .event__text");
      expect(rows.map((row) => row.text())).toEqual([
        "Hallway Light turned on",
        "Apple TV turned on",
      ]);
    } finally {
      wrapper.unmount();
      bounds.mockRestore();
    }
  });

  it("shows the average as Indoor Temp alongside the outdoor temperature", () => {
    useRoomsStore().setHomeClimateValues(8.4, 20.7, 21.5);
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    const climateSummary = wrapper.get(".homepage-climate");

    expect(wrapper.get(".hero__sub").text()).toContain("average indoor temperature 20.7°");
    expect(climateSummary.findAll(".label").map((label) => label.text())).toEqual([
      "Indoor Temp",
      "Outdoor Temp",
    ]);
    expect(climateSummary.findAll(".big-number").map((value) => value.text())).toEqual([
      "20.7°",
      "8.4°",
    ]);
  });

  it("shows unavailable indoor and outdoor readings in the climate row", () => {
    useRoomsStore().mode = "live";
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    expect(
      wrapper
        .get(".homepage-climate")
        .findAll(".big-number")
        .map((value) => value.text()),
    ).toEqual(["—", "—"]);
    wrapper.unmount();
  });
});
