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

  it("surfaces the most recent activity when lights are on", () => {
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    expect(wrapper.get("h1").text()).toBe("Front door unlocked by Allister.");
  });

  it("falls back to 'Everything's quiet.' when there is no recent activity", () => {
    useActivityStore().events = [];
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    expect(wrapper.get("h1").text()).toBe("Everything's quiet.");
    expect(wrapper.get(".events").text()).toBe("No recent activity.");
  });

  it("shows 'Lights out.' when every light is off, regardless of activity", () => {
    useRoomsStore().setAllLights(false);
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    expect(wrapper.get("h1").text()).toBe("Lights out.");
  });

  it("marks the activity feed as sourced from Home Assistant when live", () => {
    useActivityStore().status = "live";
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain("Activity · Home Assistant");
  });
});
