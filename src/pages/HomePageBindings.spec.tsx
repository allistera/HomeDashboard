import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

import HomePage from "@/pages/HomePage";
import { formatUkDate } from "@/composables/useClock";
import { applyEntities } from "@/services/haSync";
import { entity, entityStates } from "@/services/haTestSupport";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

describe("HomePage bindings", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("renders the bound climate, camera and media-player state", async () => {
    const rooms = useRoomsStore();
    rooms.setHomeClimateValues(8.4, 20.7, 21.5);
    const livingRoom = rooms.rooms.find((room) => room.id === "living-room")!;
    livingRoom.media!.title = "Night Jazz";
    livingRoom.media!.playing = true;

    const backGarden = useSecurityStore().cameras.find((camera) => camera.id === "back-garden")!;
    backGarden.live = true;
    backGarden.snapshotUrl = "http://camera.local/back-garden-snap";
    backGarden.streamUrl = "http://camera.local/back-garden-stream";

    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });

    expect(wrapper.get(".topbar").text()).toContain(formatUkDate(new Date()));
    expect(wrapper.get(".topbar").text()).not.toContain("OUTSIDE");
    expect(wrapper.get(".homepage-climate").text()).toContain("Outdoor Temp");
    expect(wrapper.get(".homepage-climate").text()).toContain("8.4°");
    expect(wrapper.get(".homepage-climate").text()).toContain("Indoor Temp");
    expect(wrapper.text()).toContain("20.7°");
    expect(wrapper.get(".homepage-climate").text()).not.toContain("21.5°");
    expect(wrapper.text()).toContain("Playing · Living room");
    expect(wrapper.text()).toContain("Night Jazz");
    expect(wrapper.get(".camera__stream").attributes("src")).toContain(
      "http://camera.local/back-garden-snap",
    );
    expect(wrapper.get(".camera__stream").attributes("src")).not.toContain("back-garden-stream");

    await wrapper.get(".camera").trigger("click");
    expect(wrapper.get('[role="dialog"] .camera-modal__stream').attributes("src")).toBe(
      "http://camera.local/back-garden-stream",
    );
    expect(document.body.style.overflow).toBe("hidden");

    await wrapper.get('[aria-label="Close camera view"]').trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
    wrapper.unmount();
  });

  it("shows the bound Back Garden camera on Home when connected", async () => {
    const backGarden = entity("camera.back_garden_back_garden", "idle", {
      friendly_name: "Back Garden",
      access_token: "fixture-camera-token",
    });
    const highResolution = entity(
      "camera.back_garden_back_garden_high_resolution_channel",
      "recording",
      {
        friendly_name: "Back Garden High resolution channel",
        access_token: "fixture-camera-token",
      },
    );
    useSettingsStore().url = "http://ha.local";
    applyEntities(entityStates(highResolution, backGarden));

    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.text()).toContain("Back Garden · Preview");
      expect(wrapper.get(".camera__stream").attributes("src")).toContain(
        `/api/camera_proxy/${backGarden.entity_id}?`,
      );
      await wrapper.get(".camera").trigger("click");
      expect(wrapper.get('[role="dialog"] .camera-modal__title').text()).toBe("Back Garden");
      await wrapper.get('[aria-label="Close camera view"]').trigger("click");

      applyEntities(entityStates(highResolution));
      await nextTick();
      expect(wrapper.text()).toContain("Back Garden · Unavailable");
      expect(wrapper.find(".camera__stream").exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("shows the live temperature in Jaicob's homepage room row", () => {
    const temperature = entity("sensor.jaicob_s_room_temperature", "18.4", {
      unit_of_measurement: "°C",
    });
    applyEntities(entityStates(temperature), new Map());
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get('[aria-label="View Jaicobs Room"] .row__meta').text()).toBe("18.4°");
    } finally {
      wrapper.unmount();
    }
  });

  it("controls the bound media player from the homepage", async () => {
    const rooms = useRoomsStore();
    const livingRoom = rooms.rooms.find((room) => room.id === "living-room")!;
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    const pauseButton = wrapper.get('[aria-label="Pause"]');

    expect(livingRoom.media!.playing).toBe(true);
    expect(pauseButton.text()).toBe("❚❚");
    await pauseButton.trigger("click");

    expect(livingRoom.media!.playing).toBe(false);
    expect(wrapper.get('[aria-label="Play"]').text()).toBe("▶");
    expect(wrapper.text()).toContain("Paused · Living room");
  });
});
