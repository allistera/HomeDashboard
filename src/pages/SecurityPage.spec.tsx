import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { applyDevices } from "@/services/homeySync";
import { TestDevice } from "@/services/homeyTestSupport";
import type { HomeyDevice } from "@/services/homeyTypes";
import SecurityPage from "@/pages/SecurityPage";
import { useSecurityStore } from "@/stores/security";

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("SecurityPage cameras", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    setVisibility("visible");
  });

  it("shows all Homey cameras across zones and reconciles updates and removals", async () => {
    const garden: HomeyDevice = new TestDevice("garden-camera", {});
    garden.class = "camera";
    garden.name = "Garden camera";
    garden.zone = "unmapped-garden";
    garden.images = [{ imageObj: { url: "/api/image/garden" } }];
    const doorbell: HomeyDevice = new TestDevice("doorbell", {});
    doorbell.class = "doorbell";
    doorbell.name = "Doorbell";
    doorbell.available = false;
    doorbell.videos = [{ type: "camera", videoObj: { id: "doorbell-video" } }];
    const speaker = new TestDevice("speaker", {});
    const inventory = new Map([
      [garden.id, garden],
      [doorbell.id, doorbell],
      [speaker.id, speaker],
    ]);
    applyDevices(inventory);
    const wrapper = mount(SecurityPage);
    try {
      expect(wrapper.findAll("button.camera")).toHaveLength(2);
      expect(wrapper.text()).toContain("2 CAMERAS FOUND");
      expect(wrapper.text()).toContain("Garden camera");
      expect(wrapper.text()).toContain("Doorbell · Camera offline");
      expect(
        useSecurityStore().cameras.find((camera) => camera.id === garden.id)?.snapshotUrl,
      ).toBe("/api/image/garden");
      expect(useSecurityStore().cameras.some((camera) => camera.id === "front-door")).toBe(false);
      await wrapper.get('[aria-label="Garden camera camera"]').trigger("click");
      expect(wrapper.get('[role="dialog"]').text()).toContain("Garden camera");
      garden.name = "Back garden";
      applyDevices(inventory);
      await flushPromises();
      expect(wrapper.get('[role="dialog"]').text()).toContain("Back garden");
      inventory.delete(garden.id);
      applyDevices(inventory);
      await flushPromises();
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
      expect(wrapper.findAll("button.camera")).toHaveLength(1);
      applyDevices(new Map());
      await flushPromises();
      expect(wrapper.findAll("button.camera")).toHaveLength(0);
      expect(wrapper.text()).toContain("No cameras found in Homey.");
    } finally {
      wrapper.unmount();
    }
  });

  it("opens a larger live camera view and closes it with Escape", async () => {
    const security = useSecurityStore();
    const frontDoor = security.cameras.find((camera) => camera.id === "front-door")!;
    frontDoor.live = true;
    frontDoor.snapshotUrl = "http://camera.local/front-door-snap";
    frontDoor.streamUrl = "http://camera.local/front-door-stream";

    const wrapper = mount(SecurityPage);
    expect(wrapper.get(".camera__stream").attributes("src")).toContain("front-door-snap");
    expect(wrapper.get(".camera__stream").attributes("src")).not.toContain("front-door-stream");

    await wrapper.findAll(".camera")[0]!.trigger("click");

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes("aria-modal")).toBe("true");
    expect(dialog.get(".camera-modal__title").text()).toBe("front door");
    expect(dialog.get("img").attributes("src")).toBe("http://camera.local/front-door-stream");
    expect(document.body.style.overflow).toBe("hidden");

    await dialog.trigger("keydown", { key: "Escape" });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
    wrapper.unmount();
  });

  it("shows an unavailable state and closes from the close button", async () => {
    const wrapper = mount(SecurityPage);
    await wrapper.findAll(".camera")[1]!.trigger("click");

    expect(wrapper.get(".camera-modal__empty").text()).toContain("Live stream unavailable");
    await wrapper.get(".camera-modal__close").trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("falls back when the enlarged stream cannot load", async () => {
    const security = useSecurityStore();
    const frontDoor = security.cameras.find((camera) => camera.id === "front-door")!;
    frontDoor.live = true;
    frontDoor.streamUrl = "http://camera.local/broken-stream";

    const wrapper = mount(SecurityPage);
    await wrapper.findAll(".camera")[0]!.trigger("click");
    await wrapper.get(".camera-modal__stream").trigger("error");

    expect(wrapper.find(".camera-modal__stream").exists()).toBe(false);
    expect(wrapper.get(".camera-modal__empty").text()).toContain("Live stream unavailable");
    expect(wrapper.find(".camera-modal__live").exists()).toBe(false);
    wrapper.unmount();
  });

  it("drops the modal stream while the page is hidden", async () => {
    const security = useSecurityStore();
    const frontDoor = security.cameras.find((camera) => camera.id === "front-door")!;
    frontDoor.live = true;
    frontDoor.streamUrl = "http://camera.local/front-door-stream";

    const wrapper = mount(SecurityPage);
    await wrapper.findAll(".camera")[0]!.trigger("click");
    expect(wrapper.get(".camera-modal__stream").attributes("src")).toBe(
      "http://camera.local/front-door-stream",
    );

    setVisibility("hidden");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".camera-modal__stream").exists()).toBe(false);

    setVisibility("visible");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".camera-modal__stream").attributes("src")).toBe(
      "http://camera.local/front-door-stream",
    );
    wrapper.unmount();
  });
});
