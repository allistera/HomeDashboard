import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

import RoomsPage from "@/pages/RoomsPage";
import { applyEntities } from "@/services/haSync";
import { entity, entityStates } from "@/services/haTestSupport";
import { useActivityStore } from "@/stores/activity";
import { useRoomsStore } from "@/stores/rooms";

describe("RoomsPage Home Assistant inventory", () => {
  let pinia = createPinia();
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });
  it("shows the live state and availability count for allowlisted entities", async () => {
    const temperature = entity("sensor.livingroom_temperature_temperature", "18", {
      friendly_name: "Room temperature",
      unit_of_measurement: "°C",
    });
    const media = entity("media_player.living_room_apple_tv", "unavailable", {
      friendly_name: "Room media",
    });
    const diagnostic = entity("sensor.demo_signal", "50", { friendly_name: "Signal strength" });
    const areas = new Map([
      [temperature.entity_id, "Kitchen"],
      [diagnostic.entity_id, "Living Room"],
    ]);
    applyEntities(entityStates(temperature, media, diagnostic), areas);

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      const devices = wrapper.get('[aria-label="Room devices"]');
      expect(devices.findAll("summary").map((row) => row.get(".row__name").text())).toEqual([
        "Room media",
        "Room temperature",
      ]);
      const summaryStates = () =>
        devices.findAll("summary").map((row) => row.get("span.row__meta").text());
      expect(summaryStates()).toEqual(["unavailable", "18 °C"]);
      expect(wrapper.text()).toContain("2 devices · 1 offline");

      const updatedTemperature = { ...temperature, state: "19" };
      applyEntities(
        entityStates(updatedTemperature, { ...media, state: "playing" }, diagnostic),
        areas,
      );
      await nextTick();
      expect(summaryStates()).toEqual(["playing", "19 °C"]);

      applyEntities(entityStates(updatedTemperature, diagnostic), areas);
      await nextTick();
      expect(devices.text()).toContain("19 °C");
      expect(devices.text()).not.toContain("Room media");
      expect(devices.text()).not.toContain("Signal strength");
      expect(wrapper.text()).toContain("1 devices · 0 offline");
    } finally {
      wrapper.unmount();
    }
  });

  it("lists the Living Room lights only under lighting controls", () => {
    const livingRoom = entity("light.living_room_livingroom_light", "on", {
      friendly_name: "Livingroom Light",
    });
    const diningRoom = entity("light.living_room_livingroom_light_2", "off", {
      friendly_name: "Dining Room",
    });
    applyEntities(entityStates(livingRoom, diningRoom));

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get('[aria-label="Room devices"]').findAll("summary")).toHaveLength(0);
      expect(wrapper.findAll(".room-light .row__name").map((row) => row.text())).toEqual([
        "Livingroom Light",
        "Dining Room",
      ]);
    } finally {
      wrapper.unmount();
    }
  });

  it("keeps area cameras and activity independent of the device allowlist", () => {
    const camera = entity("camera.living_room", "recording", {
      friendly_name: "Living room camera",
    });
    const motion = entity("binary_sensor.other_room_motion", "on");
    applyEntities(
      entityStates(camera, motion),
      new Map([
        [camera.entity_id, "Living Room"],
        [motion.entity_id, "Living Room"],
      ]),
    );
    useActivityStore().receive([
      {
        id: "motion-event",
        occurredAt: 1,
        time: "11:30",
        text: "Motion detected in the living room",
        domain: "binary_sensor",
        sourceId: motion.entity_id,
        sourceName: "Motion",
      },
    ]);

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get('[aria-label="Room devices"]').find("summary").exists()).toBe(false);
      expect(
        wrapper.find('[aria-label="Open Living room camera camera in larger view"]').exists(),
      ).toBe(true);
      expect(wrapper.text()).toContain("Motion detected in the living room");
    } finally {
      wrapper.unmount();
    }
  });

  it("shows Main Bedroom's verified devices and uses its temperature sensor", () => {
    const temperature = entity("sensor.bedroom_temperature_temperature", "20", {
      friendly_name: "Bedroom Temperature",
      unit_of_measurement: "°C",
    });
    const humidity = entity("sensor.bedroom_temperature_humidity", "44", {
      friendly_name: "Bedroom Humidity",
      unit_of_measurement: "%",
    });
    const dial = entity("event.main_bedroom_bedroom_switch_rotary", "2026-11-26T09:45:00+00:00", {
      friendly_name: "Bedroom Switch Rotary",
    });
    const groupedLight = entity("light.main_bedroom_bedrooms", "on", {
      friendly_name: "Bedrooms",
      entity_id: ["light.elsies_bedroom_elsies_light"],
    });
    const bedroomEntities = [temperature, humidity, dial, groupedLight];
    applyEntities(
      entityStates(...bedroomEntities),
      new Map(bedroomEntities.map((item) => [item.entity_id, "Main Bedroom"])),
    );
    const rooms = useRoomsStore();
    rooms.selectRoom("bedroom");

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get("h1").text()).toBe("Main Bedroom");
      expect(rooms.selectedRoom.temp).toBe(20);
      const devices = wrapper.get('[aria-label="Room devices"]');
      expect(devices.findAll("summary").map((row) => row.get(".row__name").text())).toEqual([
        "Bedroom Humidity",
        "Bedroom Switch Rotary",
        "Bedroom Temperature",
      ]);
      expect(wrapper.find(".brightness-slider").exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("shows the live temperature for Jaicob's room in the summary and Devices", () => {
    const temperature = entity("sensor.jaicob_s_room_temperature", "21.5", {
      friendly_name: "Jaicob's Room Temperature",
      unit_of_measurement: "°C",
    });
    applyEntities(entityStates(temperature), new Map([[temperature.entity_id, "Jaicobs Room"]]));
    useRoomsStore().selectRoom("jaicobs-room");

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get(".hero__sub").text()).toContain("temperature 21.5°");
      const device = wrapper.get('[aria-label="Room devices"] summary');
      expect(device.get(".row__name").text()).toBe("Jaicob's Room Temperature");
      expect(device.get("span.row__meta").text()).toBe("21.5 °C");
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
