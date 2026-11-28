import { mount } from "@vue/test-utils";
import Hls from "hls.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CameraTile from "@/components/CameraTile";

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("CameraTile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16, 19, 42, 0));
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("renders a snapshot image and emits select when clicked", async () => {
    const wrapper = mount(CameraTile, {
      props: {
        name: "front door",
        live: true,
        imageUrl: "http://ha.local/camera-snap?token=abc",
      },
    });

    expect(wrapper.get("img").attributes("src")).toBe(
      `http://ha.local/camera-snap?token=abc&time=${Date.now()}`,
    );
    expect(wrapper.get("img").attributes("decoding")).toBe("async");
    expect(wrapper.text()).toContain("LIVE");
    expect(wrapper.get("button").attributes("aria-haspopup")).toBe("dialog");

    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("select")).toHaveLength(1);
  });

  it("refreshes the snapshot on an interval", async () => {
    const wrapper = mount(CameraTile, {
      props: {
        name: "front door",
        live: true,
        imageUrl: "http://ha.local/camera-snap",
        refreshMs: 1000,
      },
    });

    const first = wrapper.get("img").attributes("src");
    vi.advanceTimersByTime(1000);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("img").attributes("src")).not.toBe(first);
    expect(wrapper.get("img").attributes("src")).toContain("http://ha.local/camera-snap");
  });

  it("does not refresh snapshots while the page is hidden", async () => {
    const wrapper = mount(CameraTile, {
      props: {
        name: "front door",
        live: true,
        imageUrl: "http://ha.local/camera-snap",
        refreshMs: 1000,
      },
    });

    const first = wrapper.get("img").attributes("src");
    setVisibility("hidden");
    vi.advanceTimersByTime(5000);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("img").attributes("src")).toBe(first);
  });

  it("shows the unavailable state when the snapshot image fails", async () => {
    const wrapper = mount(CameraTile, {
      props: {
        name: "driveway",
        live: true,
        imageUrl: "http://ha.local/broken-snap",
      },
    });

    await wrapper.get("img").trigger("error");

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain("STREAM UNAVAILABLE");
    expect(wrapper.text()).not.toContain("LIVE");
  });

  it("does not claim a camera is live without an image URL", () => {
    const wrapper = mount(CameraTile, {
      props: { name: "hallway", live: true },
    });

    expect(wrapper.text()).not.toContain("LIVE");
  });

  it("uses the HLS player when native support is uncertain", async () => {
    const canPlay = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("maybe");
    const isSupported = vi.spyOn(Hls, "isSupported").mockReturnValue(true);
    const loadSource = vi.spyOn(Hls.prototype, "loadSource").mockImplementation(() => undefined);
    const attachMedia = vi.spyOn(Hls.prototype, "attachMedia").mockImplementation(() => undefined);
    const hlsUrl = "https://ha.example/api/hls/fixture/master_playlist.m3u8";
    const wrapper = mount(CameraTile, {
      props: { name: "Back Garden", videoPreview: true, hlsUrl },
    });

    try {
      await vi.dynamicImportSettled();
      expect(loadSource).toHaveBeenCalledWith(hlsUrl);
      expect(attachMedia).toHaveBeenCalledWith(wrapper.get("video").element);
    } finally {
      wrapper.unmount();
      canPlay.mockRestore();
      isSupported.mockRestore();
      loadSource.mockRestore();
      attachMedia.mockRestore();
    }
  });
});
