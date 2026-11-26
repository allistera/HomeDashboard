import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import RoomCamera from "@/components/RoomCamera";

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
