import { describe, expect, it } from "vitest";

import {
  startWebRtcStream,
  type WebRtcClientConfig,
  type WebRtcOfferEvent,
  type WebRtcPeer,
  type WebRtcSignalConnection,
  type WebRtcSignalMessage,
} from "@/services/haWebRtc";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeCandidate(sdpMid: string | null, candidate: string): RTCIceCandidate {
  const init: RTCIceCandidateInit = {
    candidate,
    sdpMid,
    sdpMLineIndex: sdpMid === null ? null : 0,
  };
  // SAFETY: the service only reads `candidate` and calls `toJSON`, which this fake provides.
  return { ...init, toJSON: () => init } as RTCIceCandidate;
}

function fakeStream(): MediaStream {
  const stream: Partial<MediaStream> = { id: "remote-stream" };
  // SAFETY: jsdom has no MediaStream; the service only forwards the object to the caller.
  return stream as MediaStream;
}

function iceEvent(candidate: RTCIceCandidate): RTCPeerConnectionIceEvent {
  const event: Partial<RTCPeerConnectionIceEvent> = { candidate };
  // SAFETY: the service only reads `candidate` from the event.
  return event as RTCPeerConnectionIceEvent;
}

function trackEvent(stream: MediaStream): RTCTrackEvent {
  const event: Partial<RTCTrackEvent> = { streams: [stream] };
  // SAFETY: the service only reads `streams` (and `track` when streams is empty).
  return event as RTCTrackEvent;
}

class FakePeer implements WebRtcPeer {
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  signalingState: RTCSignalingState = "stable";
  transceivers: string[] = [];
  dataChannels: string[] = [];
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  addedCandidates: RTCIceCandidateInit[] = [];
  closed = false;

  addTransceiver(kind: "audio" | "video", init: RTCRtpTransceiverInit): void {
    this.transceivers.push(`${kind}:${init.direction ?? ""}`);
  }
  createDataChannel(label: string): void {
    this.dataChannels.push(label);
  }
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "v=0 fake offer" };
  }
  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description;
    this.signalingState = "have-local-offer";
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description;
    this.signalingState = "stable";
  }
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    this.addedCandidates.push(candidate);
  }
  close(): void {
    this.closed = true;
  }
}

class FakeConnection implements WebRtcSignalConnection {
  messages: WebRtcSignalMessage[] = [];
  offerCallback: ((event: WebRtcOfferEvent) => void) | null = null;
  unsubscribed = 0;
  configError: Error | null = null;
  config: WebRtcClientConfig = { configuration: { iceServers: [{ urls: "stun:stun.test:3478" }] } };

  async sendMessagePromise(message: WebRtcSignalMessage): Promise<WebRtcClientConfig | null> {
    this.messages.push(message);
    if (message.type === "camera/webrtc/get_client_config") {
      if (this.configError) throw this.configError;
      return this.config;
    }
    return null;
  }

  async subscribeMessage(
    callback: (event: WebRtcOfferEvent) => void,
    message: WebRtcSignalMessage,
  ): Promise<() => void> {
    this.messages.push(message);
    this.offerCallback = callback;
    return () => {
      this.unsubscribed += 1;
    };
  }
}

function setup() {
  const connection = new FakeConnection();
  const peer = new FakePeer();
  const configurations: RTCConfiguration[] = [];
  const streams: MediaStream[] = [];
  const errors: string[] = [];
  const session = startWebRtcStream(
    connection,
    "camera.garden",
    {
      onStream: (stream) => streams.push(stream),
      onError: (message) => errors.push(message),
    },
    (configuration) => {
      configurations.push(configuration);
      return peer;
    },
  );
  return { connection, peer, configurations, streams, errors, session };
}

describe("startWebRtcStream", () => {
  it("offers the camera an SDP after fetching the client configuration", async () => {
    const { connection, peer, configurations } = setup();
    await flush();

    expect(configurations).toEqual([{ iceServers: [{ urls: "stun:stun.test:3478" }] }]);
    expect(peer.transceivers).toEqual(["audio:recvonly", "video:recvonly"]);
    expect(peer.localDescription).toEqual({ type: "offer", sdp: "v=0 fake offer" });
    expect(connection.messages).toEqual([
      { type: "camera/webrtc/get_client_config", entity_id: "camera.garden" },
      { type: "camera/webrtc/offer", entity_id: "camera.garden", offer: "v=0 fake offer" },
    ]);
  });

  it("opens the data channel some cameras require", async () => {
    const connection = new FakeConnection();
    connection.config = { configuration: {}, dataChannel: "dataSendChannel" };
    const peer = new FakePeer();
    startWebRtcStream(
      connection,
      "camera.garden",
      { onStream: () => undefined, onError: () => undefined },
      () => peer,
    );
    await flush();

    expect(peer.dataChannels).toEqual(["dataSendChannel"]);
  });

  it("holds local ICE candidates until Home Assistant assigns a session id", async () => {
    const { connection, peer } = setup();
    await flush();

    const early = fakeCandidate("0", "candidate:1 early");
    peer.onicecandidate?.(iceEvent(early));
    await flush();
    expect(connection.messages.filter((m) => m.type === "camera/webrtc/candidate")).toEqual([]);

    connection.offerCallback?.({ type: "session", session_id: "session-1" });
    const late = fakeCandidate("0", "candidate:2 late");
    peer.onicecandidate?.(iceEvent(late));
    await flush();

    expect(connection.messages.filter((m) => m.type === "camera/webrtc/candidate")).toEqual([
      {
        type: "camera/webrtc/candidate",
        entity_id: "camera.garden",
        session_id: "session-1",
        candidate: { candidate: "candidate:1 early", sdpMid: "0", sdpMLineIndex: 0 },
      },
      {
        type: "camera/webrtc/candidate",
        entity_id: "camera.garden",
        session_id: "session-1",
        candidate: { candidate: "candidate:2 late", sdpMid: "0", sdpMLineIndex: 0 },
      },
    ]);
  });

  it("applies the answer and remote candidates to the peer connection", async () => {
    const { connection, peer } = setup();
    await flush();

    connection.offerCallback?.({ type: "answer", answer: "v=0 fake answer" });
    connection.offerCallback?.({
      type: "candidate",
      candidate: { candidate: "candidate:9 remote", sdpMid: "1", sdpMLineIndex: 1 },
    });
    connection.offerCallback?.({
      type: "candidate",
      candidate: { candidate: "candidate:10 bare" },
    });
    await flush();

    expect(peer.remoteDescription).toEqual({ type: "answer", sdp: "v=0 fake answer" });
    expect(peer.addedCandidates).toEqual([
      { candidate: "candidate:9 remote", sdpMid: "1", sdpMLineIndex: 1 },
      { candidate: "candidate:10 bare", sdpMid: "0" },
    ]);
  });

  it("hands the remote media stream to the caller when a track arrives", async () => {
    const { peer, streams } = setup();
    await flush();

    const stream = fakeStream();
    peer.ontrack?.(trackEvent(stream));

    expect(streams).toEqual([stream]);
  });

  it("reports Home Assistant errors and tears the session down", async () => {
    const { connection, peer, errors } = setup();
    await flush();

    connection.offerCallback?.({
      type: "error",
      code: "webrtc_offer_failed",
      message: "Camera does not support WebRTC",
    });
    await flush();

    expect(errors).toEqual(["Camera does not support WebRTC"]);
    expect(peer.closed).toBe(true);
    expect(connection.unsubscribed).toBe(1);
  });

  it("reports when the client configuration cannot be fetched", async () => {
    const connection = new FakeConnection();
    connection.configError = new Error("not supported");
    const errors: string[] = [];
    let created = 0;
    startWebRtcStream(
      connection,
      "camera.garden",
      { onStream: () => undefined, onError: (message) => errors.push(message) },
      () => {
        created += 1;
        return new FakePeer();
      },
    );
    await flush();

    expect(errors).toEqual(["not supported"]);
    expect(created).toBe(0);
  });

  it("stops by closing the peer and ending the offer subscription", async () => {
    const { connection, peer, session } = setup();
    await flush();

    session.stop();
    await flush();

    expect(peer.closed).toBe(true);
    expect(connection.unsubscribed).toBe(1);
  });

  it("ignores signalling that arrives after stop", async () => {
    const { connection, peer, session, streams } = setup();
    await flush();
    session.stop();

    connection.offerCallback?.({ type: "answer", answer: "v=0 late answer" });
    peer.ontrack?.(trackEvent(fakeStream()));
    await flush();

    expect(peer.remoteDescription).toBeNull();
    expect(streams).toEqual([]);
  });
});
