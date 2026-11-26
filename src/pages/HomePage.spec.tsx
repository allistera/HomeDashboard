import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import HomePage from "@/pages/HomePage";
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
    expect(quietHome.get(".events").text()).toBe("No recent activity.");
    quietHome.unmount();
  });

  it("labels the homepage night button 'Get Jaicob'", () => {
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    expect(wrapper.get(".btn--primary").text()).toBe("Get Jaicob");
    expect(wrapper.findAll(".hero__actions button").map((button) => button.text())).toContain(
      "Night Time",
    );
  });

  it("marks the activity feed as sourced from Home Assistant when live", () => {
    useActivityStore().status = "live";
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain("Activity · Home Assistant");
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
