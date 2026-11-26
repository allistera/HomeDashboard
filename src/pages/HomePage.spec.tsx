import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import HomePage from "@/pages/HomePage";
import { activityEventFromHa } from "@/services/haActivity";
import { useActivityStore } from "@/stores/activity";
import { useRoomsStore } from "@/stores/rooms";

describe("HomePage headline", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("shows the requested headline regardless of home activity or light state", () => {
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    const headline = "Check Home Assistant for issues with devices and authentication status.";
    expect(wrapper.get("h1").text()).toBe(headline);
    wrapper.unmount();

    useActivityStore().events = [];
    useRoomsStore().setAllLights(false);
    const quietHome = mount(HomePage, { global: { plugins: [pinia] } });
    expect(quietHome.get("h1").text()).toBe(headline);
    expect(quietHome.get(".events").text()).toBe("Connect Home Assistant to see activity.");
    quietHome.unmount();
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

      activity.receive(
        ["Hallway Light", "Apple TV", "Kitchen Light"].map((name, index) =>
          activityEventFromHa({ when: 1_796_000_000 - index, name, state: "on" })!,
        ),
      );
      await nextTick();
      expect(wrapper.text()).toContain("Activity · Home Assistant");
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

  it("shows the indoor average in the home summary and the outdoor temperature separately", () => {
    useRoomsStore().setHomeClimateValues(8.4, 20.7, 21.5);
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    const climateSummary = wrapper.get(".homepage-climate");

    expect(wrapper.get(".hero__sub").text()).toContain("average indoor temperature 20.7°");
    expect(climateSummary.findAll(".label").map((label) => label.text())).toEqual([
      "Target",
      "Outdoor Temp",
    ]);
    expect(climateSummary.text()).toContain("21.5°");
    expect(climateSummary.text()).toContain("8.4°");
    expect(climateSummary.text()).not.toContain("House temp");
    expect(climateSummary.text()).not.toContain("20.7°");
  });
});
