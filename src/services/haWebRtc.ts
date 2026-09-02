import { haConnection } from "@/services/haClient";

// Signalling for Home Assistant's `camera/webrtc/*` WebSocket commands. The
// media itself flows peer-to-peer between the browser and go2rtc; Home
// Assistant only relays the SDP offer/answer and ICE candidates.

export type WebRtcClientConfigRequest = {
  type: "camera/webrtc/get_client_config";
  entity_id: string;
};

export type WebRtcOfferRequest = {
  type: "camera/webrtc/offer";
  entity_id: string;
  offer: string;
};

export type WebRtcCandidateRequest = {
  type: "camera/webrtc/candidate";
  entity_id: string;
  session_id: string;
  candidate: RTCIceCandidateInit;
};

export type WebRtcSignalMessage =
  | WebRtcClientConfigRequest
  | WebRtcOfferRequest
  | WebRtcCandidateRequest;

export interface WebRtcClientConfig {
  configuration: RTCConfiguration;
  dataChannel?: string;
}

export type WebRtcOfferEvent =
  | { type: "session"; session_id: string }
  | { type: "answer"; answer: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
  | { type: "error"; code: string; message: string };

export interface WebRtcSignalConnection {
  sendMessagePromise(message: WebRtcSignalMessage): Promise<WebRtcClientConfig | null>;
  subscribeMessage(
    callback: (event: WebRtcOfferEvent) => void,
    message: WebRtcSignalMessage,
  ): Promise<() => void | Promise<void>>;
}

// The slice of RTCPeerConnection the signalling code needs, so tests can
// stand in a fake and the browser API stays at the boundary.
export interface WebRtcPeer {
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  addTransceiver(kind: "audio" | "video", init: RTCRtpTransceiverInit): void;
  createDataChannel(label: string): void;
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  close(): void;
}

export interface WebRtcStreamHandlers {
  onStream(stream: MediaStream): void;
  onError(message: string): void;
}

export interface WebRtcSession {
  stop(): void;
}

export type WebRtcPeerFactory = (configuration: RTCConfiguration) => WebRtcPeer;

export type WebRtcStarter = (
  entityId: string,
  handlers: WebRtcStreamHandlers,
) => WebRtcSession | null;

function describeError(error: Error | string): string {
  return error instanceof Error ? error.message : String(error);
}

export function startWebRtcStream(
  connection: WebRtcSignalConnection,
  entityId: string,
  handlers: WebRtcStreamHandlers,
  createPeer: WebRtcPeerFactory,
): WebRtcSession {
  let stopped = false;
  let peer: WebRtcPeer | null = null;
  let unsubscribe: (() => void | Promise<void>) | null = null;
  let sessionId: string | null = null;
  let remoteStream: MediaStream | null = null;
  let announcedStream: MediaStream | null = null;
  const pendingCandidates: RTCIceCandidateInit[] = [];

  const stop = () => {
    if (stopped) return;
    stopped = true;
    const end = unsubscribe;
    unsubscribe = null;
    if (end) void end();
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
      peer = null;
    }
  };

  const fail = (message: string) => {
    if (stopped) return;
    stop();
    handlers.onError(message);
  };

  const sendCandidate = (candidate: RTCIceCandidateInit) => {
    if (sessionId === null) {
      pendingCandidates.push(candidate);
      return;
    }
    void connection
      .sendMessagePromise({
        type: "camera/webrtc/candidate",
        entity_id: entityId,
        session_id: sessionId,
        candidate,
      })
      .catch(() => undefined);
  };

  const onOfferEvent = (event: WebRtcOfferEvent) => {
    if (stopped || !peer) return;
    switch (event.type) {
      case "session":
        sessionId = event.session_id;
        for (const candidate of pendingCandidates.splice(0)) sendCandidate(candidate);
        break;
      case "answer":
        peer
          .setRemoteDescription({ type: "answer", sdp: event.answer })
          .catch((error: Error | string) => fail(describeError(error)));
        break;
      case "candidate": {
        const remote = event.candidate;
        // go2rtc omits the media line; browsers require one of sdpMid/sdpMLineIndex.
        const candidate =
          remote.sdpMid || remote.sdpMLineIndex != null
            ? remote
            : { candidate: remote.candidate, sdpMid: "0" };
        peer.addIceCandidate(candidate).catch(() => undefined);
        break;
      }
      case "error":
        fail(event.message);
        break;
    }
  };

  const negotiate = async () => {
    const config = await connection.sendMessagePromise({
      type: "camera/webrtc/get_client_config",
      entity_id: entityId,
    });
    if (stopped) return;

    const created = createPeer(config?.configuration ?? {});
    peer = created;
    if (config?.dataChannel) created.createDataChannel(config.dataChannel);

    created.onicecandidate = (event) => {
      if (event.candidate?.candidate) sendCandidate(event.candidate.toJSON());
    };
    created.ontrack = (event) => {
      if (stopped) return;
      let stream = event.streams.at(0);
      if (!stream) {
        remoteStream ??= new MediaStream();
        remoteStream.addTrack(event.track);
        stream = remoteStream;
      }
      if (stream !== announcedStream) {
        announcedStream = stream;
        handlers.onStream(stream);
      }
    };
    created.addTransceiver("audio", { direction: "recvonly" });
    created.addTransceiver("video", { direction: "recvonly" });

    const offer = await created.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    if (stopped) return;
    await created.setLocalDescription(offer);
    if (stopped) return;
    if (!offer.sdp) {
      fail("Browser produced an empty WebRTC offer");
      return;
    }

    const end = await connection.subscribeMessage(onOfferEvent, {
      type: "camera/webrtc/offer",
      entity_id: entityId,
      offer: offer.sdp,
    });
    if (stopped) {
      void end();
      return;
    }
    unsubscribe = end;
  };

  negotiate().catch((error: Error | string) => fail(describeError(error)));

  return { stop };
}

// Default starter for the dashboard: uses the live Home Assistant connection
// and the browser's RTCPeerConnection. Returns null when either is missing so
// callers can fall back to the MJPEG proxy.
export function startHaWebRtcStream(
  entityId: string,
  handlers: WebRtcStreamHandlers,
): WebRtcSession | null {
  const connection = haConnection();
  if (!connection || !("RTCPeerConnection" in globalThis)) return null;
  return startWebRtcStream(
    connection,
    entityId,
    handlers,
    (configuration) => new RTCPeerConnection(configuration),
  );
}
