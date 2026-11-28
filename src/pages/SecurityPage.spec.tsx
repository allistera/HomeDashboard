import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import SecurityPage from "@/pages/SecurityPage";
import { applyEntities } from "@/services/haSync";
import { entity, entityStates, makeVideoReady } from "@/services/haTestSupport";
import * as webRtc from "@/services/haWebRtc";
import { useHaStore } from "@/stores/ha";
import { useSecurityStore } from "@/stores/security";

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("SecurityPage Home Assistant entities", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setVisibility("visible");
  });
  it("discovers cameras and shows a contact sensor without a lock control", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const garden = entity("camera.garden", "recording", { friendly_name: "Garden camera" });
    const doorbell = entity("camera.doorbell", "unavailable", { friendly_name: "Doorbell" });
    const contact = entity("binary_sensor.front_door_contact", "on", {
      friendly_name: "Front door contact",
    });
    applyEntities(entityStates(garden, doorbell, contact));

    const wrapper = mount(SecurityPage, { global: { plugins: [pinia] } });
    try {
      expect(wrapper.text()).toContain("2 CAMERAS FOUND");
      expect(wrapper.text()).toContain("Garden camera");
      expect(wrapper.text()).toContain("Camera offline");
      expect(wrapper.text()).toContain("OPEN");
      expect(wrapper.find('[aria-label="Front door lock"]').exists()).toBe(false);
      applyEntities(entityStates(doorbell, contact));
      await nextTick();
      expect(wrapper.text()).not.toContain("Garden camera");
      applyEntities(entityStates(contact));
      await nextTick();
      expect(wrapper.text()).toContain("No cameras found in Home Assistant.");
    } finally {
      wrapper.unmount();
    }
  });

  it("starts live previews for available cameras and shares the stream with the viewer", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const garden = entity("camera.garden", "recording", { friendly_name: "Garden camera" });
    const doorbell = entity("camera.doorbell", "unavailable", { friendly_name: "Doorbell" });
    applyEntities(entityStates(garden, doorbell));
    const ha = useHaStore();
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const stop = vi.fn();
    const start = vi.spyOn(webRtc, "startHaWebRtcStream").mockReturnValue({ stop });
    const wrapper = mount(SecurityPage, { global: { plugins: [pinia] } });
    try {
      expect(start).not.toHaveBeenCalled();
      ha.status = "connected";
      await nextTick();
      expect(start).toHaveBeenCalledExactlyOnceWith("camera.garden", expect.any(Object));

      const stream: Partial<MediaStream> = { id: "garden-stream" };
      // SAFETY: jsdom does not implement MediaStream. Players only assign it to their video elements.
      start.mock.calls[0]![1].onStream(stream as MediaStream);
      await nextTick();
      const tile = wrapper.get('[aria-label="Open Garden camera camera in larger view"]');
      const video = tile.get<HTMLVideoElement>("video");
      expect(video.element.srcObject).toBe(stream);
      expect(tile.text()).toContain("Connecting…");
      makeVideoReady(video.element);
      await video.trigger("playing");
      expect(tile.text()).toContain("LIVE");

      await tile.trigger("click");
      expect(wrapper.get<HTMLVideoElement>('[role="dialog"] video').element.srcObject).toBe(stream);
      expect(start).toHaveBeenCalledOnce();
      await wrapper.get('[aria-label="Close camera view"]').trigger("click");

      applyEntities(entityStates(garden, { ...doorbell, state: "recording" }));
      await nextTick();
      expect(start).toHaveBeenLastCalledWith("camera.doorbell", expect.any(Object));
      ha.status = "connecting";
      await nextTick();
      expect(stop).toHaveBeenCalledTimes(2);
    } finally {
      wrapper.unmount();
      play.mockRestore();
      start.mockRestore();
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
