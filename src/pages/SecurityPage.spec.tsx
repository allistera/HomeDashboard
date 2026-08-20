import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

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

  it("opens a larger live camera view and closes it with Escape", async () => {
    const security = useSecurityStore();
    const frontDoor = security.cameras.find((camera) => camera.id === "front-door")!;
    frontDoor.live = true;
    frontDoor.snapshotUrl = "http://ha.local/front-door-snap";
    frontDoor.streamUrl = "http://ha.local/front-door-stream";

    const wrapper = mount(SecurityPage);
    expect(wrapper.get(".camera__stream").attributes("src")).toContain("front-door-snap");
    expect(wrapper.get(".camera__stream").attributes("src")).not.toContain("front-door-stream");

    await wrapper.findAll(".camera")[0]!.trigger("click");

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes("aria-modal")).toBe("true");
    expect(dialog.get(".camera-modal__title").text()).toBe("front door");
    expect(dialog.get("img").attributes("src")).toBe("http://ha.local/front-door-stream");
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
    frontDoor.streamUrl = "http://ha.local/broken-stream";

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
    frontDoor.streamUrl = "http://ha.local/front-door-stream";

    const wrapper = mount(SecurityPage);
    await wrapper.findAll(".camera")[0]!.trigger("click");
    expect(wrapper.get(".camera-modal__stream").attributes("src")).toBe(
      "http://ha.local/front-door-stream",
    );

    setVisibility("hidden");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".camera-modal__stream").exists()).toBe(false);

    setVisibility("visible");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".camera-modal__stream").attributes("src")).toBe(
      "http://ha.local/front-door-stream",
    );
    wrapper.unmount();
  });
});
