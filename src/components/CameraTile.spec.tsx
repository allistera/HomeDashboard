import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import CameraTile from "@/components/CameraTile";

describe("CameraTile", () => {
  it("renders a live stream and emits select when clicked", async () => {
    const wrapper = mount(CameraTile, {
      props: {
        name: "front door",
        live: true,
        streamUrl: "http://ha.local/camera-stream",
      },
    });

    expect(wrapper.get("img").attributes("src")).toBe("http://ha.local/camera-stream");
    expect(wrapper.text()).toContain("LIVE");
    expect(wrapper.get("button").attributes("aria-haspopup")).toBe("dialog");

    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("select")).toHaveLength(1);
  });

  it("shows the unavailable state when the stream image fails", async () => {
    const wrapper = mount(CameraTile, {
      props: {
        name: "driveway",
        live: true,
        streamUrl: "http://ha.local/broken-stream",
      },
    });

    await wrapper.get("img").trigger("error");

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain("STREAM UNAVAILABLE");
    expect(wrapper.text()).not.toContain("LIVE");
  });

  it("does not claim a camera is live without a stream URL", () => {
    const wrapper = mount(CameraTile, {
      props: { name: "hallway", live: true },
    });

    expect(wrapper.text()).not.toContain("LIVE");
  });
});
