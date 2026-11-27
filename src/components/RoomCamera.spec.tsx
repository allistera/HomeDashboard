import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import RoomCamera from "@/components/RoomCamera";
import * as haHls from "@/services/haHls";
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
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const requestHls = vi.spyOn(haHls, "requestHaHlsUrl").mockResolvedValue(null);
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
      expect(play).toHaveBeenCalledOnce();
      expect(wrapper.text()).toContain("Connecting…");

      await vi.advanceTimersByTimeAsync(12_000);
      expect(start).toHaveBeenCalledTimes(2);
      expect(requestHls).toHaveBeenCalledWith(camera.id);
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
      requestHls.mockRestore();
      play.mockRestore();
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });

  it("plays the Home Assistant HLS stream inline and in the viewer when WebRTC times out", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const canPlay = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");
    const url = "https://ha.example/api/hls/fixture/master_playlist.m3u8";
    const requestHls = vi.spyOn(haHls, "requestHaHlsUrl").mockResolvedValue(url);
    const stop = vi.fn();
    const start = vi.spyOn(webRtc, "startHaWebRtcStream").mockReturnValue({ stop });
    const wrapper = mount(RoomCamera, { props: { camera, livePreview: true } });
    try {
      await vi.advanceTimersByTimeAsync(12_000);
      expect(stop).toHaveBeenCalledOnce();
      const preview = wrapper.get(".camera > video");
      expect(preview.attributes("src")).toBe(url);
      await preview.trigger("playing");

      await wrapper.get(".camera").trigger("click");
      const viewer = wrapper.get('[role="dialog"] video');
      expect(viewer.attributes("src")).toBe(url);
      await viewer.trigger("playing");
      expect(wrapper.get('[role="dialog"] .label').text()).toBe("Camera · Live");
      expect(start).toHaveBeenCalledOnce();
      expect(requestHls).toHaveBeenCalledOnce();

      await wrapper.get('[aria-label="Close camera view"]').trigger("click");
      await preview.trigger("waiting");
      expect(wrapper.text()).toContain("Connecting…");
      await vi.advanceTimersByTimeAsync(12_000);
      expect(start).toHaveBeenCalledTimes(2);
      expect(preview.attributes("src")).toBeUndefined();
    } finally {
      wrapper.unmount();
      start.mockRestore();
      requestHls.mockRestore();
      canPlay.mockRestore();
      load.mockRestore();
      play.mockRestore();
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });

  it("opens the enlarged viewer with the same live session and keeps it on close", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const stop = vi.fn();
    const start = vi.spyOn(webRtc, "startHaWebRtcStream").mockReturnValue({ stop });
    const wrapper = mount(RoomCamera, { props: { camera, livePreview: true } });
    try {
      await wrapper.get(".camera").trigger("click");
      expect(start).toHaveBeenCalledOnce();
      expect(wrapper.get('[role="dialog"] .label').text()).toBe("Camera · Connecting…");

      const stream: Partial<MediaStream> = { id: "preview-stream" };
      // SAFETY: jsdom has no MediaStream; the players only assign it to their video elements.
      start.mock.calls[0]![1].onStream(stream as MediaStream);
      await nextTick();
      const expanded = wrapper.get<HTMLVideoElement>('[role="dialog"] video');
      expect(expanded.element.srcObject).toBe(stream);
      await expanded.trigger("playing");
      expect(wrapper.get('[role="dialog"] .label').text()).toBe("Camera · Live");

      await wrapper.get('[aria-label="Close camera view"]').trigger("click");
      expect(wrapper.get<HTMLVideoElement>(".camera > video").element.srcObject).toBe(stream);
      expect(start).toHaveBeenCalledOnce();
      expect(stop).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
      start.mockRestore();
      visibility.mockRestore();
      play.mockRestore();
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
