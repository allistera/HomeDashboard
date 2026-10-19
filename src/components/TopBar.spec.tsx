import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import TopBar from "@/components/TopBar";
import { connectHomey, disconnectHomey, setHomeyCapability } from "@/services/homeyClient";
import { TestDevice, TestHomey } from "@/services/homeyTestSupport";
import { useHomeyStore } from "@/stores/homey";
import { useSettingsStore } from "@/stores/settings";
import { applyDevices } from "@/services/homeySync";

function mountTopBar() {
  return mount(TopBar, { props: { left: [], status: "HOME" } });
}

describe("Homey communication warning", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => disconnectHomey());

  it("shows setup guidance before configuration and hides during an initial connection", async () => {
    const wrapper = mountTopBar();
    try {
      expect(wrapper.get('[role="alert"]').text()).toContain("Homey is not connected.");
      expect(wrapper.get('[role="alert"]').text()).toContain("access token in Settings.");
      useSettingsStore().url = "https://homey.example";
      useSettingsStore().token = "test-token";
      useHomeyStore().status = "connecting";
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("shows connection failures directly below the menu", async () => {
    const wrapper = mountTopBar();
    try {
      useSettingsStore().url = "https://homey.example";
      useSettingsStore().token = "test-token";
      await connectHomey(
        () => {},
        async () => {
          throw new Error("Unreachable");
        },
      );
      await flushPromises();
      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain("Homey communication issue.");
      expect(alert.text()).toContain("Could not connect to Homey.");
      expect(wrapper.get("header").element.nextElementSibling).toBe(alert.element);
    } finally {
      wrapper.unmount();
    }
  });

  it("warns during reconnect attempts and clears when the connection recovers", async () => {
    const wrapper = mountTopBar();
    try {
      useSettingsStore().url = "https://homey.example";
      useSettingsStore().token = "test-token";
      const homey = new TestHomey([]);
      await connectHomey(
        () => {},
        async () => homey,
      );
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      homey.emit("disconnect");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("Connection lost — retrying…");
      homey.emit("reconnect");
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("shows failed device commands and clears after a successful command", async () => {
    const wrapper = mountTopBar();
    try {
      useSettingsStore().url = "https://homey.example";
      useSettingsStore().token = "test-token";
      const light = new TestDevice("light", { onoff: false });
      await connectHomey(
        () => {},
        async () => new TestHomey([light]),
      );
      light.failWrites = true;
      expect(await setHomeyCapability(light.id, "onoff", true)).toBe("failed");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("Homey could not update Test device.");
      light.failWrites = false;
      expect(await setHomeyCapability(light.id, "onoff", true)).toBe("sent");
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("warns while disconnected and switches to setup guidance after settings are cleared", async () => {
    const wrapper = mountTopBar();
    try {
      useSettingsStore().url = "https://homey.example";
      useSettingsStore().token = "test-token";
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("Unable to communicate with Homey.");
      useSettingsStore().clear();
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("Homey is not connected.");
    } finally {
      wrapper.unmount();
    }
  });
});

describe("Homey people dropdown", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    useSettingsStore().url = "https://homey.example";
    useSettingsStore().token = "test-token";
  });
  afterEach(() => disconnectHomey());

  it("labels discovered people and follows presence, device changes, and disconnection", async () => {
    const alex = new TestDevice("alex-device", { presence: true });
    alex.class = "sensor";
    alex.name = "Alex";
    const casey = new TestDevice("casey-device", { presence: false });
    casey.class = "sensor";
    casey.name = "Casey";
    const homey = new TestHomey([alex, casey]);
    const wrapper = mount(TopBar, { props: { left: [], status: "HOME", showPeople: true } });
    try {
      expect(await connectHomey(applyDevices, async () => homey)).toBe(true);
      await flushPromises();
      expect(wrapper.get(".topbar__people").text()).toContain("1 PERSON HOME");
      expect(wrapper.findAll(".topbar__popover-row").map((row) => row.text())).toEqual([
        "AlexHOME",
        "CaseyAWAY",
      ]);

      alex.emit("presence", false);
      await flushPromises();
      expect(wrapper.get(".topbar__people").text()).toContain("0 PEOPLE HOME");
      expect(wrapper.get(".topbar__popover-row").text()).toBe("AlexAWAY");

      alex.name = "Alex renamed";
      alex.available = false;
      homey.emitDevice("device.update", alex);
      await flushPromises();
      expect(wrapper.get(".topbar__popover-row").text()).toBe("Alex renamedUNAVAILABLE");

      homey.emitDevice("device.delete", casey);
      await flushPromises();
      expect(wrapper.get(".topbar__people").text()).toContain("PRESENCE UNAVAILABLE");
      expect(wrapper.findAll(".topbar__popover-row")).toHaveLength(1);

      const sam = new TestDevice("sam-device", { presence: false });
      sam.class = "sensor";
      sam.name = "Sam";
      homey.emitDevice("device.create", sam);
      await flushPromises();
      sam.emit("presence", true);
      await flushPromises();
      expect(wrapper.get(".topbar__people").text()).toContain("1 PERSON HOME");
      expect(wrapper.get(".topbar__popover").text()).toContain("SamHOME");

      homey.emit("disconnect");
      await flushPromises();
      expect(wrapper.get(".topbar__people").text()).toContain("PRESENCE UNAVAILABLE");
      expect(wrapper.get(".topbar__popover").text()).toBe("Presence unavailable.");

      disconnectHomey();
      sam.emit("presence", true);
      await flushPromises();
      expect(sam.destroyed).toBe(1);
      expect(wrapper.get(".topbar__people").text()).toContain("PRESENCE UNAVAILABLE");
    } finally {
      wrapper.unmount();
    }
  });

  it("explains when no person devices are discovered", async () => {
    await connectHomey(applyDevices, async () => new TestHomey([]));
    const wrapper = mount(TopBar, { props: { left: [], status: "HOME", showPeople: true } });
    try {
      expect(wrapper.get(".topbar__people").text()).toContain("PRESENCE UNAVAILABLE");
      expect(wrapper.get(".topbar__popover").text()).toBe("No person devices found.");
    } finally {
      wrapper.unmount();
    }
  });

  it("clears live presence when the user disconnects Homey", async () => {
    const person = new TestDevice("person-device", { presence: true });
    await connectHomey(applyDevices, async () => new TestHomey([person]));
    const wrapper = mount(TopBar, { props: { left: [], status: "HOME", showPeople: true } });
    try {
      expect(wrapper.get(".topbar__people").text()).toContain("1 PERSON HOME");
      disconnectHomey();
      await flushPromises();
      expect(wrapper.get(".topbar__people").text()).toContain("PRESENCE UNAVAILABLE");
      expect(wrapper.get(".topbar__popover").text()).toBe("Presence unavailable.");
    } finally {
      wrapper.unmount();
    }
  });
});
