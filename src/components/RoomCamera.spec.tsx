import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import RoomCamera from "@/components/RoomCamera";
import * as webRtc from "@/services/haWebRtc";

const camera = {
  id: "camera.front_door",
  name: "Front door",
  available: true,
  snapshotUrl: "https://ha.example/api/camera_proxy/camera.front_door?token=camera-fixture",
};

describe("RoomCamera", () => {
  it("shows a Home Assistant snapshot and opens it in the camera viewer", async () => {
    const wrapper = mount(RoomCamera, { props: { camera, height: 250 } });
    try {
      expect(wrapper.get(".camera__stream").attributes("src")).toContain(camera.snapshotUrl);
      expect(wrapper.get(".camera__stream").attributes("referrerpolicy")).toBe("no-referrer");

      await wrapper.get(".camera").trigger("click");
      expect(wrapper.get('[role="dialog"] .camera-modal__title').text()).toBe("Front door");
      expect(wrapper.get('[role="dialog"] .camera-modal__stream').attributes("src")).toBe(
        camera.snapshotUrl,
      );

      await wrapper.setProps({ camera: { ...camera, id: "camera.garden" } });
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("retries a live preview without frames, then keeps the active player", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const stop = vi.fn();
    const stream: Partial<MediaStream> = { id: "preview-stream" };
    const start = vi.spyOn(webRtc, "startHaWebRtcStream").mockImplementation((_, handlers) => {
      // SAFETY: jsdom has no MediaStream; the tile only assigns it to the video element.
      handlers.onStream(stream as MediaStream);
      return { stop };
    });
    const wrapper = mount(RoomCamera, { props: { camera, livePreview: true } });
    try {
      await nextTick();
      expect(start).toHaveBeenCalledWith(camera.id, expect.any(Object));
      expect(wrapper.get<HTMLVideoElement>("video.camera__stream").element.srcObject).toBe(stream);
      expect(wrapper.text()).toContain("Connecting…");

      await vi.advanceTimersByTimeAsync(12_000);
      expect(start).toHaveBeenCalledTimes(2);
      expect(stop).toHaveBeenCalledOnce();
      await wrapper.get("video").trigger("playing");
      await vi.advanceTimersByTimeAsync(12_000);
      expect(start).toHaveBeenCalledTimes(2);
      expect(wrapper.text()).toContain("LIVE");

      await wrapper.setProps({ livePreview: false });
      expect(stop).toHaveBeenCalledTimes(2);
      expect(wrapper.find("video").exists()).toBe(false);
      expect(wrapper.get("img.camera__stream").attributes("src")).toContain(camera.snapshotUrl);
    } finally {
      wrapper.unmount();
      start.mockRestore();
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does not request a snapshot when the camera goes offline", async () => {
    const wrapper = mount(RoomCamera, { props: { camera } });
    try {
      expect(wrapper.find(".camera__stream").exists()).toBe(true);
      await wrapper.setProps({ camera: { ...camera, available: false } });
      expect(wrapper.find(".camera__stream").exists()).toBe(false);
      expect(wrapper.text()).toContain("Camera offline");
    } finally {
      wrapper.unmount();
    }
  });
});
