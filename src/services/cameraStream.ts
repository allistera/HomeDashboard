// Homey has no generic equivalent of HA's camera/webrtc signalling commands.
// A camera integration can supply a browser stream starter independently.
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

export function startCameraStream(): WebRtcSession | null {
  return null;
}
