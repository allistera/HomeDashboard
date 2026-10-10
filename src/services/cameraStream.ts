import { homeyCameraVideo } from "@/services/homeyClient";
import { useSettingsStore } from "@/stores/settings";

export interface WebRtcStreamHandlers {
  onStream(stream: MediaStream): void;
  onError(message: string): void;
}

export interface WebRtcSession {
  stop(): void;
}

export type WebRtcStarter = (
  deviceId: string,
  handlers: WebRtcStreamHandlers,
) => WebRtcSession | null;

export function startCameraStream(
  deviceId: string,
  handlers: WebRtcStreamHandlers,
): WebRtcSession | null {
  const video = homeyCameraVideo(deviceId);
  if (!video || !globalThis.RTCPeerConnection) return null;
  const settings = useSettingsStore();
  const endpoint = `${settings.url}/api/manager/videos/video/${encodeURIComponent(video.id)}`;
  const token = settings.token;
  const controller = new AbortController();
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    bundlePolicy: "max-compat",
  });
  const stream = new MediaStream();
  let stopped = false;
  let keepAlive: ReturnType<typeof setTimeout> | undefined;
  let gatherTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    controller.abort();
    clearTimeout(keepAlive);
    clearTimeout(gatherTimer);
    clearTimeout(timeout);
    peer.close();
    stream.getTracks().forEach((track) => track.stop());
  };
  const fail = () => {
    if (stopped) return;
    stop();
    handlers.onError("Live stream unavailable");
  };
  const timeout = setTimeout(fail, 30000);
  const post = async (path: string, body: HomeyVideoRequest) => {
    const response = await fetch(`${endpoint}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Video request failed");
    return response;
  };
  peer.ontrack = (event) => {
    if (stopped) return;
    stream.addTrack(event.track);
    if (event.track.kind === "video") {
      clearTimeout(timeout);
      handlers.onStream(stream);
    }
  };
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === "failed" || peer.connectionState === "disconnected") fail();
  };
  const connect = async () => {
    try {
      peer.addTransceiver("audio", { direction: "recvonly" });
      peer.addTransceiver("video", { direction: "recvonly" });
      if (video.options?.dataChannel !== false) peer.createDataChannel("data");
      await peer.setLocalDescription(await peer.createOffer());
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(gatherTimer);
          resolve();
        };
        if (stopped || peer.iceGatheringState === "complete") return done();
        gatherTimer = setTimeout(done, 1000);
        controller.signal.addEventListener("abort", done, { once: true });
        peer.onicecandidate = (event) => {
          if (!event.candidate) done();
        };
      });
      if (stopped) return;
      const offer = peer.localDescription?.sdp;
      if (!offer) throw new Error("No video offer");
      const response = await post("offer", { offer });
      const answer: HomeyVideoAnswer = await response.json();
      if (stopped) return;
      if (!answer.answerSdp) throw new Error("No video answer");
      await peer.setRemoteDescription({
        type: "answer",
        sdp: answer.answerSdp.replace(/a=sendrecv/g, "a=sendonly"),
      });
      const ping = async () => {
        try {
          await post("keep-alive", { streamId: answer.streamId });
          if (!stopped) keepAlive = setTimeout(ping, 60000);
        } catch {
          fail();
        }
      };
      if (!stopped && answer.streamId) keepAlive = setTimeout(ping, 60000);
    } catch {
      fail();
    }
  };
  void connect();
  return { stop };
}

interface HomeyVideoAnswer {
  answerSdp: string;
  streamId?: string;
}

interface HomeyVideoRequest {
  offer?: string;
  streamId?: string;
}
