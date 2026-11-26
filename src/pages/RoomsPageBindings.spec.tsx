import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
      friendly_name: "Livingroom Temperature Temperature",
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
        "Livingroom Temperature",
        "Room media",
      ]);
      const summaryStates = () =>
        devices.findAll("summary").map((row) => row.get("span.row__meta").text());
      expect(summaryStates()).toEqual(["18 °C", "unavailable"]);
      expect(wrapper.text()).toContain("2 devices · 1 offline");

      const updatedTemperature = { ...temperature, state: "19" };
      applyEntities(
        entityStates(updatedTemperature, { ...media, state: "playing" }, diagnostic),
        areas,
      );
      await nextTick();
      expect(summaryStates()).toEqual(["19 °C", "playing"]);

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

  it("lists the Living Room lights, including TV Backlight, only under lighting controls", async () => {
    const livingRoom = entity("light.living_room_livingroom_light", "on", {
      friendly_name: "Livingroom Light",
    });
    const diningRoom = entity("light.living_room_livingroom_light_2", "off", {
      friendly_name: "Dining Room",
    });
    const backlight = entity("light.living_room_tv_backlight", "on", {
      friendly_name: "TV Backlight",
    });
    applyEntities(entityStates(livingRoom, diningRoom, backlight));

    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.get('[aria-label="Room devices"]').findAll("summary")).toHaveLength(0);
      expect(wrapper.findAll(".room-light .row__name").map((row) => row.text())).toEqual([
        "Livingroom Light",
        "Dining Room",
        "TV Backlight",
      ]);
      const backlightToggle = wrapper.get('[aria-label="TV Backlight power"]');
      expect(backlightToggle.attributes("aria-checked")).toBe("true");
      applyEntities(entityStates(livingRoom, diningRoom, { ...backlight, state: "off" }));
      await nextTick();
      expect(backlightToggle.attributes("aria-checked")).toBe("false");
    } finally {
      wrapper.unmount();
    }
  });

  it("opens an inline picker that follows the reported light colour and supports both modes", async () => {
    const coloured = entity("light.living_room_livingroom_light", "on", {
      friendly_name: "Livingroom Light",
      supported_color_modes: ["xy", "color_temp"],
      color_mode: "xy",
      hs_color: [24, 68],
      rgb_color: [255, 151, 82],
      min_color_temp_kelvin: 2000,
      max_color_temp_kelvin: 6500,
    });
    const dimmable = entity("light.living_room_livingroom_light_2", "on", {
      supported_color_modes: ["brightness"],
    });
    const setColour = vi.spyOn(useRoomsStore(), "setLightColour").mockResolvedValue();
    applyEntities(entityStates(coloured, dimmable));
    const wrapper = mount(RoomsPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.findAll(".room-light__swatch")).toHaveLength(1);
      const swatch = wrapper.get('[aria-label="Change Livingroom Light colour"]');
      expect(swatch.attributes("title")).toBe("Current colour #FF9752");
      await swatch.trigger("click");
      expect(swatch.attributes("aria-expanded")).toBe("true");
      const picker = wrapper.get('[aria-label="Livingroom Light colour picker"]');
      expect(picker.get(".colour-picker__values").text()).toContain("Hue 24° · Sat 68%");
      expect(picker.get(".colour-picker__values").text()).toContain("#FF9752");

      await picker.get('[aria-label="Blue"]').trigger("click");
      expect(setColour).toHaveBeenLastCalledWith(
        "living-room",
        { mode: "colour", hs: [215, 79] },
        "livingroom-light",
      );
      await picker.get(".colour-picker__apply").trigger("click");
      expect(setColour).toHaveBeenLastCalledWith("living-room", { mode: "colour", hs: [215, 79] });

      applyEntities(
        entityStates(
          {
            ...coloured,
            attributes: { ...coloured.attributes, hs_color: [120, 100], rgb_color: [0, 255, 0] },
          },
          dimmable,
        ),
      );
      await nextTick();
      expect(swatch.attributes("title")).toBe("Current colour #00FF00");
      expect(picker.get(".colour-picker__values").text()).toContain("#00FF00");

      await picker.findAll(".colour-picker__modes button")[1]!.trigger("click");
      await picker.get('input[aria-label="White colour temperature"]').setValue(3200);
      expect(setColour).toHaveBeenLastCalledWith(
        "living-room",
        { mode: "temperature", kelvin: 3200 },
        "livingroom-light",
      );
      await picker.trigger("keydown", { key: "Escape" });
      expect(swatch.attributes("aria-expanded")).toBe("false");

      applyEntities(
        entityStates(
          entity(coloured.entity_id, "off", {
            friendly_name: "Livingroom Light",
            supported_color_modes: ["xy", "color_temp"],
          }),
          dimmable,
        ),
      );
      await nextTick();
      expect(swatch.attributes("title")).toBe("Last reported colour #00FF00");
    } finally {
      wrapper.unmount();
      setColour.mockRestore();
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
