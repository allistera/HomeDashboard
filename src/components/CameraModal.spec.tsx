import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import CameraModal from "@/components/CameraModal";
import type { WebRtcSession, WebRtcStreamHandlers } from "@/services/haWebRtc";
import type { Camera } from "@/stores/security";

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function fakeStream(): MediaStream {
  const stream: Partial<MediaStream> = { id: "remote-stream" };
  // SAFETY: jsdom has no MediaStream; the modal only assigns it to the video element.
  return stream as MediaStream;
}

const camera: Camera = {
  id: "front-door",
  name: "front door",
  live: true,
  entityId: "camera.front_door",
  snapshotUrl: "http://ha.local/front-door-snap",
  streamUrl: "http://ha.local/front-door-stream",
};

function fakeStarter() {
  const calls: string[] = [];
  const handlers: WebRtcStreamHandlers[] = [];
  let stopped = 0;
  const start = (entityId: string, streamHandlers: WebRtcStreamHandlers): WebRtcSession => {
    calls.push(entityId);
    handlers.push(streamHandlers);
    return {
      stop: () => {
        stopped += 1;
      },
    };
  };
  return { start, calls, handlers, stopCount: () => stopped };
}

describe("CameraModal", () => {
  beforeEach(() => {
    setVisibility("visible");
  });

  it("plays the WebRTC stream in a video element once it connects", async () => {
    const starter = fakeStarter();
    const wrapper = mount(CameraModal, { props: { camera, startStream: starter.start } });

    expect(starter.calls).toEqual(["camera.front_door"]);
    expect(wrapper.text()).toContain("Connecting");
    expect(wrapper.find("img.camera-modal__stream").exists()).toBe(false);
    const video = wrapper.get<HTMLVideoElement>("video.camera-modal__stream");
    expect(video.attributes("poster")).toBe("http://ha.local/front-door-snap");
    expect(video.attributes("autoplay")).toBeDefined();
    expect(video.attributes("playsinline")).toBeDefined();

    const stream = fakeStream();
    starter.handlers[0]!.onStream(stream);
    await wrapper.vm.$nextTick();

    expect(video.element.srcObject).toBe(stream);
    expect(wrapper.text()).toContain("Live");
    expect(wrapper.find(".camera-modal__live").exists()).toBe(true);
    wrapper.unmount();
  });

  it("falls back to the MJPEG proxy stream when WebRTC fails", async () => {
    const starter = fakeStarter();
    const wrapper = mount(CameraModal, { props: { camera, startStream: starter.start } });

    starter.handlers[0]!.onError("Camera does not support WebRTC");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("video").exists()).toBe(false);
    expect(wrapper.get("img.camera-modal__stream").attributes("src")).toBe(
      "http://ha.local/front-door-stream",
    );
    expect(starter.stopCount()).toBe(1);
    wrapper.unmount();
  });

  it("uses the MJPEG proxy stream when WebRTC is not available", () => {
    const wrapper = mount(CameraModal, {
      props: { camera, startStream: () => null },
    });

    expect(wrapper.find("video").exists()).toBe(false);
    expect(wrapper.get("img.camera-modal__stream").attributes("src")).toBe(
      "http://ha.local/front-door-stream",
    );
    wrapper.unmount();
  });

  it("does not try WebRTC for a camera without a bound entity", () => {
    const starter = fakeStarter();
    const wrapper = mount(CameraModal, {
      props: { camera: { ...camera, entityId: undefined }, startStream: starter.start },
    });

    expect(starter.calls).toEqual([]);
    expect(wrapper.get("img.camera-modal__stream").attributes("src")).toBe(
      "http://ha.local/front-door-stream",
    );
    wrapper.unmount();
  });

  it("stops the WebRTC session while the page is hidden and restarts when visible", async () => {
    const starter = fakeStarter();
    const wrapper = mount(CameraModal, { props: { camera, startStream: starter.start } });

    setVisibility("hidden");
    await wrapper.vm.$nextTick();
    expect(starter.stopCount()).toBe(1);
    expect(wrapper.find("video").exists()).toBe(false);

    setVisibility("visible");
    await wrapper.vm.$nextTick();
    expect(starter.calls).toEqual(["camera.front_door", "camera.front_door"]);
    expect(wrapper.find("video").exists()).toBe(true);
    wrapper.unmount();
  });

  it("stops the WebRTC session when the modal closes", () => {
    const starter = fakeStarter();
    const wrapper = mount(CameraModal, { props: { camera, startStream: starter.start } });

    wrapper.unmount();

    expect(starter.stopCount()).toBe(1);
  });
});
