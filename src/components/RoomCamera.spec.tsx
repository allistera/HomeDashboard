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
    URL.createObjectURL = vi.fn().mockReturnValue("blob:snapshot");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

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
