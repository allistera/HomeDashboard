import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import RoomsPage from "@/pages/RoomsPage";
import { useRoomsStore } from "@/stores/rooms";
import { connectHomey, disconnectHomey } from "@/services/homeyClient";
import { applyDevices } from "@/services/homeySync";
import { TestDevice, TestHomey } from "@/services/homeyTestSupport";
import { homePageBindings } from "@/services/homeyBindings/homeyHomeBindings";
import { useSettingsStore } from "@/stores/settings";

describe("RoomsPage bindings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows the zone camera without a media player and removes it when leaving the room", async () => {
    const camera = new TestDevice("room-camera", {});
    camera.class = "camera";
    camera.name = "Hall camera";
    camera.zone = homePageBindings.roomZoneIds.hallway!;
    applyDevices(new Map([[camera.id, camera]]));
    const rooms = useRoomsStore();
    rooms.selectRoom("hallway");
    const wrapper = mount(RoomsPage);
    expect(wrapper.find('[aria-label="Hall camera camera"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Camera image unavailable");
    expect(wrapper.text()).not.toContain("now playing artwork");
    expect(rooms.selectedRoom.media).toBeUndefined();
    rooms.selectRoom("kitchen");
    await flushPromises();
    expect(wrapper.find(".camera").exists()).toBe(false);
    wrapper.unmount();
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

  it("expands device properties and keeps unbound sensor readings current", async () => {
    const sensor = new TestDevice("room-sensor", {
      measure_temperature: 0,
      alarm_motion: false,
      measure_battery: null,
    });
    sensor.name = "Room sensor";
    sensor.class = "sensor";
    sensor.zone = homePageBindings.roomZoneIds["living-room"];
    sensor.capabilitiesObj.measure_temperature.title = "Temperature";
    sensor.capabilitiesObj.measure_temperature.units = "°C";
    useSettingsStore().url = "https://homey.example";
    useSettingsStore().token = "test-token";
    const wrapper = mount(RoomsPage);
    try {
      await connectHomey(applyDevices, async () => new TestHomey([sensor]));
      await flushPromises();
      const details = wrapper.get<HTMLDetailsElement>("details.device-details");
      expect(details.element.open).toBe(false);
      details.get<HTMLElement>("summary").element.click();
      expect(details.element.open).toBe(true);
      expect(details.text()).toContain("Temperature");
      expect(details.text()).toContain("0 °C");
      expect(details.text()).toContain("No");
      expect(details.text()).toContain("Unknown");
      sensor.emit("measure_temperature", 22.5);
      await flushPromises();
      expect(details.element.open).toBe(true);
      expect(details.text()).toContain("22.5 °C");
      details.get<HTMLElement>("summary").element.click();
      expect(details.element.open).toBe(false);
    } finally {
      wrapper.unmount();
      disconnectHomey();
    }
  });

  it("lists every zone device and follows inventory changes without adding controls", async () => {
    const inventory = ["light", "sensor", "speaker", "camera", "washer"].map((type) => {
      const device = new TestDevice(`unbound-${type}`, {});
      device.name = `Room ${type}`;
      device.class = type;
      device.zone = homePageBindings.roomZoneIds["living-room"];
      return device;
    });
    inventory[1].available = false;
    const elsewhere = new TestDevice("elsewhere", {});
    elsewhere.name = "Other room device";
    elsewhere.zone = homePageBindings.roomZoneIds.kitchen;
    const homey = new TestHomey([...inventory, elsewhere]);
    useSettingsStore().url = "https://homey.example";
    useSettingsStore().token = "test-token";
    const wrapper = mount(RoomsPage);
    try {
      await connectHomey(applyDevices, async () => homey);
      await flushPromises();
      const list = wrapper.get('[aria-label="Room devices"]');
      expect(list.findAll(".row")).toHaveLength(5);
      for (const device of inventory) expect(list.text()).toContain(device.name);
      expect(list.text()).not.toContain(elsewhere.name);
      expect(list.text()).toContain("OFFLINE");
      expect(wrapper.text()).toContain("5 devices · 1 offline");
      expect(list.findAll("button")).toHaveLength(0);

      inventory[1].name = "Renamed sensor";
      inventory[1].available = true;
      homey.emitDevice("device.update", inventory[1]);
      await flushPromises();
      expect(list.text()).toContain("Renamed sensor");
      expect(wrapper.text()).toContain("5 devices · 0 offline");
      inventory[1].zone = homePageBindings.roomZoneIds.kitchen;
      homey.emitDevice("device.update", inventory[1]);
      homey.emitDevice("device.delete", inventory[0]);
      await flushPromises();
      expect(list.findAll(".row")).toHaveLength(3);
      expect(list.text()).not.toContain("Renamed sensor");
      const added = new TestDevice("new-device", {});
      added.name = "New fan";
      added.class = "fan";
      added.zone = homePageBindings.roomZoneIds["living-room"];
      homey.emitDevice("device.create", added);
      await flushPromises();
      expect(list.text()).toContain("New fan");
      useRoomsStore().selectRoom("kitchen");
      await flushPromises();
      expect(list.findAll(".row")).toHaveLength(2);
      expect(list.text()).toContain("Renamed sensor");
      expect(list.text()).not.toContain("New fan");
    } finally {
      wrapper.unmount();
      disconnectHomey();
    }
  });
});
