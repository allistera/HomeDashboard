import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoomCamera from "@/components/RoomCamera";
import { useSettingsStore } from "@/stores/settings";

describe("Room camera snapshots", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSettingsStore().url = "https://homey.example";
    useSettingsStore().token = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["snapshot"], { type: "image/jpeg" }),
      }),
    );
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    URL.createObjectURL = vi.fn().mockReturnValue("blob:snapshot");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps the image and refresh schedule when Homey rebuilds unchanged camera metadata", async () => {
    vi.useFakeTimers();
    const camera = {
      id: "camera",
      name: "Living room",
      available: true,
      snapshotUrl: "/api/image/camera",
    };
    const wrapper = mount(RoomCamera, { props: { camera } });
    try {
      await flushPromises();
      await wrapper.get("button.camera").trigger("click");
      const tileImage = wrapper.get("button.camera img").element;
      const modalImage = wrapper.get('[role="dialog"] img').element;
      await vi.advanceTimersByTimeAsync(5000);
      await wrapper.setProps({ camera: { ...camera } });
      await flushPromises();
      expect(wrapper.get("button.camera img").element).toBe(tileImage);
      expect(wrapper.get('[role="dialog"] img').element).toBe(modalImage);
      expect(wrapper.get("button.camera img").attributes("src")).toBe("blob:snapshot");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      expect(wrapper.text()).not.toContain("Loading camera");
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      wrapper.unmount();
    }
  });

  it("retains the current snapshot until the next image decodes, and after refresh failures", async () => {
    vi.useFakeTimers();
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const wrapper = mount(RoomCamera, {
      props: {
        camera: {
          id: "camera",
          name: "Living room",
          available: true,
          snapshotUrl: "/api/image/camera",
        },
      },
    });
    try {
      await flushPromises();
      await wrapper.get("button.camera").trigger("click");
      let finishDecode: () => void = () => {};
      vi.mocked(HTMLImageElement.prototype.decode).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishDecode = resolve;
          }),
      );
      await vi.advanceTimersByTimeAsync(10000);
      expect(wrapper.get("button.camera img").attributes("src")).toBe("blob:first");
      expect(wrapper.get('[role="dialog"] img').attributes("src")).toBe("blob:first");
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:first");
      finishDecode();
      await flushPromises();
      expect(wrapper.get("button.camera img").attributes("src")).toBe("blob:second");
      expect(wrapper.get('[role="dialog"] img').attributes("src")).toBe("blob:second");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first");
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Unavailable"));
      await vi.advanceTimersByTimeAsync(10000);
      expect(wrapper.get("button.camera img").attributes("src")).toBe("blob:second");
      expect(wrapper.text()).toContain("Last snapshot");
    } finally {
      wrapper.unmount();
    }
  });

  it("opens the snapshot in a dialog and closes with Escape, close button, or backdrop", async () => {
    const wrapper = mount(RoomCamera, {
      attachTo: document.body,
      props: {
        camera: {
          id: "camera",
          name: "Living room",
          available: true,
          snapshotUrl: "/api/image/camera",
        },
      },
    });
    await flushPromises();
    const trigger = wrapper.get<HTMLButtonElement>("button.camera");
    trigger.element.focus();
    await trigger.trigger("click");
    expect(wrapper.get('[role="dialog"] img').attributes("src")).toBe("blob:snapshot");
    expect(wrapper.get('[role="dialog"]').text()).toContain("Snapshot");
    expect(fetch).toHaveBeenCalledTimes(1);
    await wrapper.get('[role="dialog"]').trigger("keydown", { key: "Escape" });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
    await trigger.trigger("click");
    await wrapper.get('[aria-label="Close camera view"]').trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await trigger.trigger("click");
    await wrapper.get('[role="dialog"]').trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await trigger.trigger("click");
    await wrapper.setProps({ camera: { id: "kitchen", name: "Kitchen", available: false } });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("loads a Homey image with authorization and releases it on unmount", async () => {
    const wrapper = mount(RoomCamera, {
      props: {
        camera: {
          id: "camera",
          name: "Living room",
          available: true,
          snapshotUrl: "/api/image/camera",
        },
      },
    });
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith(
      "https://homey.example/api/image/camera",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
        redirect: "error",
      }),
    );
    expect(wrapper.get("img").attributes("src")).toBe("blob:snapshot");
    wrapper.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:snapshot");
  });

  it("never sends the Homey token to an external image source", async () => {
    const wrapper = mount(RoomCamera, {
      props: {
        camera: {
          id: "camera",
          name: "Hallway",
          available: true,
          snapshotUrl: "https://camera.example/snapshot",
        },
      },
    });
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith(
      "https://camera.example/snapshot",
      expect.objectContaining({ headers: {}, credentials: "omit" }),
    );
    wrapper.unmount();
  });

  it("clears the previous room image when the camera becomes unavailable", async () => {
    const wrapper = mount(RoomCamera, {
      props: {
        camera: {
          id: "camera",
          name: "Living room",
          available: true,
          snapshotUrl: "/api/image/camera",
        },
      },
    });
    await flushPromises();
    await wrapper.setProps({ camera: { id: "other", name: "Kitchen", available: false } });
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain("Camera offline");
    wrapper.unmount();
  });
});
