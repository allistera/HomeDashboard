import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import HomePage from "@/pages/HomePage";
import { connectHomey, disconnectHomey } from "@/services/homeyClient";
import { applyDevices } from "@/services/homeySync";
import { TestDevice, TestHomey } from "@/services/homeyTestSupport";
import { useSettingsStore } from "@/stores/settings";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

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

    const frontDoor = useSecurityStore().cameras.find((camera) => camera.id === "front-door")!;
    frontDoor.live = true;
    frontDoor.snapshotUrl = "http://camera.local/front-door-snap";
    frontDoor.streamUrl = "http://camera.local/front-door-stream";

    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain("OUTSIDE 8°");
    expect(wrapper.text()).toContain("20.7°");
    expect(wrapper.text()).toContain("21.5°");
    expect(wrapper.text()).toContain("Playing · Living room");
    expect(wrapper.text()).toContain("Night Jazz");
    expect(wrapper.get(".camera__stream").attributes("src")).toContain(
      "http://camera.local/front-door-snap",
    );
    expect(wrapper.get(".camera__stream").attributes("src")).not.toContain("front-door-stream");

    await wrapper.get(".camera").trigger("click");
    expect(wrapper.get('[role="dialog"] .camera-modal__stream').attributes("src")).toBe(
      "http://camera.local/front-door-stream",
    );
    expect(document.body.style.overflow).toBe("hidden");

    await wrapper.get('[aria-label="Close camera view"]').trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
    wrapper.unmount();
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

  it("shows live hallway status and switches both Homey hallway lights together", async () => {
    const downstairs = new TestDevice("50cd1111-47b0-4276-aab8-972a055bfb03", {
      onoff: true,
      dim: 0.89,
    });
    const upstairs = new TestDevice("b5941eee-99eb-407d-90d4-256599160ed7", {
      onoff: false,
      dim: 0.89,
    });
    const settings = useSettingsStore();
    settings.url = "https://homey.example";
    settings.token = "test-token";
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      await connectHomey(applyDevices, async () => new TestHomey([downstairs, upstairs]));
      await flushPromises();
      const toggle = wrapper.get('[aria-label="Hallway lights"]');
      expect(toggle.attributes("aria-checked")).toBe("true");
      await toggle.trigger("click");
      await flushPromises();
      expect(downstairs.commands).toEqual([{ capabilityId: "onoff", value: false }]);
      expect(upstairs.commands).toEqual([{ capabilityId: "onoff", value: false }]);

      downstairs.emit("onoff", false);
      await flushPromises();
      expect(toggle.attributes("aria-checked")).toBe("false");
      await toggle.trigger("click");
      await flushPromises();
      for (const light of [downstairs, upstairs]) {
        expect(light.commands.slice(1)).toEqual([
          { capabilityId: "onoff", value: true },
          { capabilityId: "dim", value: 0.7 },
        ]);
      }
      upstairs.emit("onoff", true);
      await flushPromises();
      expect(toggle.attributes("aria-checked")).toBe("true");
      upstairs.emit("onoff", false);
      await flushPromises();
      expect(toggle.attributes("aria-checked")).toBe("false");
    } finally {
      wrapper.unmount();
      disconnectHomey();
    }
  });

  it("controls Toilet Light and reflects its live Homey power state", async () => {
    const light = new TestDevice("d8b8c271-1fab-4383-9c1e-bbc414c81bb4", { onoff: false, dim: 1 });
    const settings = useSettingsStore();
    settings.url = "https://homey.example";
    settings.token = "test-token";
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      await connectHomey(applyDevices, async () => new TestHomey([light]));
      await flushPromises();
      const toggle = wrapper.get('[aria-label="Toilet lights"]');
      expect(toggle.attributes("aria-checked")).toBe("false");
      await toggle.trigger("click");
      await flushPromises();
      expect(light.commands).toEqual([
        { capabilityId: "onoff", value: true },
        { capabilityId: "dim", value: 0.7 },
      ]);
      light.emit("onoff", true);
      await flushPromises();
      expect(toggle.attributes("aria-checked")).toBe("true");
      await toggle.trigger("click");
      await flushPromises();
      expect(light.commands.at(-1)).toEqual({ capabilityId: "onoff", value: false });
      light.emit("onoff", false);
      await flushPromises();
      expect(toggle.attributes("aria-checked")).toBe("false");
    } finally {
      wrapper.unmount();
      disconnectHomey();
    }
  });

  it("shows living-room motion age alongside media and updates it from Homey", async () => {
    const sensor = new TestDevice("f0de7239-1ac7-4580-a1d5-e33733e2abef", { alarm_motion: true });
    sensor.capabilitiesObj.alarm_motion.lastUpdated = new Date(Date.now() - 6 * 60_000);
    const speaker = new TestDevice("76e05f8e-87b3-493e-bc6f-4b6ec6aa5665", {
      speaker_playing: true,
    });
    const settings = useSettingsStore();
    settings.url = "https://homey.example";
    settings.token = "test-token";
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    try {
      await connectHomey(applyDevices, async () => new TestHomey([sensor, speaker]));
      await flushPromises();
      const row = wrapper
        .findAll(".row")
        .find((item) => item.get(".row__name").text() === "Living room")!;
      expect(row.get(".row__meta").text()).toBe("MOTION 6M AGO · MEDIA ON");
      sensor.emit("alarm_motion", false);
      await flushPromises();
      expect(useRoomsStore().selectedRoom.motion?.active).toBe(false);
      expect(row.get(".row__meta").text()).toContain("MOTION ");
      expect(row.get(".row__meta").text()).not.toContain("MOTION 6M AGO");
      expect(row.get(".row__meta").text()).toContain("MEDIA ON");
    } finally {
      wrapper.unmount();
      disconnectHomey();
    }
  });

  it("shows only binding-backed room details and highlights rooms with lights on", () => {
    const rooms = useRoomsStore();
    const hallway = rooms.rooms.find((room) => room.id === "hallway")!;
    hallway.motion!.lastChangedAt = Date.now() - 6 * 60_000;
    const kitchen = rooms.rooms.find((room) => room.id === "kitchen")!;
    kitchen.media!.playing = false;
    kitchen.media!.active = false;

    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    const rows = wrapper.findAll(".row");
    const rowFor = (name: string) => rows.find((row) => row.get(".row__name").text() === name)!;

    expect(rowFor("Living room").get(".row__meta").text()).toBe("MEDIA ON");
    expect(rowFor("Kitchen").get(".row__meta").text()).toBe("");
    expect(rowFor("Hallway").get(".row__meta").text()).toBe("MOTION 6M AGO");
    expect(rowFor("Bedroom").get(".row__meta").text()).toBe("");
    expect(rowFor("Living room").classes()).not.toContain("row--dim");
    expect(rowFor("Elsies Room").classes()).toContain("row--dim");
    expect(rowFor("Bedroom").classes()).toContain("row--dim");
    expect(rowFor("Kitchen").find('[role="switch"]').exists()).toBe(false);
    expect(rowFor("Jaicobs Room").find('[role="switch"]').exists()).toBe(false);
    expect(rowFor("Elsies Room").find('[role="switch"]').exists()).toBe(false);

    wrapper.unmount();
  });
});
