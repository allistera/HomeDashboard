import { flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startCameraStream } from "@/services/cameraStream";
import { connectHomey, disconnectHomey } from "@/services/homeyClient";
import { TestDevice, TestHomey } from "@/services/homeyTestSupport";
import { useSettingsStore } from "@/stores/settings";

class TestPeer {
  static current: TestPeer;
  constructor() {
    TestPeer.current = this;
  }
  iceGatheringState = "complete";
  connectionState = "new";
  localDescription = { sdp: "offer-sdp" };
  ontrack?: (event: { track: { kind: string } }) => void;
  onconnectionstatechange?: () => void;
  addTransceiver = vi.fn();
  createDataChannel = vi.fn();
  createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" });
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  close = vi.fn();
}

class TestStream {
  addTrack = vi.fn();
  getTracks() {
    return [];
  }
}

describe("Homey live camera streaming", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    useSettingsStore().url = "https://homey.example";
    useSettingsStore().token = "test-token";
    const camera = Object.assign(new TestDevice("camera", {}), {
      videos: [{ type: "camera", videoObj: { id: "video-id" } }],
    });
    await connectHomey(
      () => {},
      async () => new TestHomey([camera]),
    );
    vi.stubGlobal("RTCPeerConnection", TestPeer);
    vi.stubGlobal("MediaStream", TestStream);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ answerSdp: "a=sendrecv", streamId: "stream-id" }),
      }),
    );
  });
  afterEach(() => {
    disconnectHomey();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("negotiates receive-only video, keeps it alive, and stops on close", async () => {
    const onStream = vi.fn();
    const onError = vi.fn();
    const session = startCameraStream("camera", { onStream, onError });
    await flushPromises();
    const peer = TestPeer.current;
    expect(peer.addTransceiver).toHaveBeenCalledWith("video", { direction: "recvonly" });
    expect(fetch).toHaveBeenCalledWith(
      "https://homey.example/api/manager/videos/video/video-id/offer",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ offer: "offer-sdp" }),
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      }),
    );
    expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "a=sendonly" });
    peer.ontrack?.({ track: { kind: "video" } });
    expect(onStream).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenLastCalledWith(
      "https://homey.example/api/manager/videos/video/video-id/keep-alive",
      expect.objectContaining({ body: JSON.stringify({ streamId: "stream-id" }) }),
    );
    session?.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(peer.close).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("falls back when no video is exposed or the offer fails", async () => {
    const onError = vi.fn();
    const handlers = { onStream: vi.fn(), onError };
    expect(startCameraStream("no-video", handlers)).toBeNull();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Unavailable"));
    startCameraStream("camera", handlers);
    await flushPromises();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(TestPeer.current.close).toHaveBeenCalledTimes(1);
  });

  it("ignores a late answer after closing", async () => {
    let finish: (response: Response) => void = () => {};
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const handlers = { onStream: vi.fn(), onError: vi.fn() };
    const session = startCameraStream("camera", handlers);
    await flushPromises();
    session?.stop();
    finish(new Response(JSON.stringify({ answerSdp: "answer" })));
    await flushPromises();
    expect(TestPeer.current.setRemoteDescription).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });
});
