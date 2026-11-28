import { defineComponent, ref, shallowRef, watch, type PropType } from "vue";

import CameraModal from "@/components/CameraModal";
import CameraTile, { type CameraTransport } from "@/components/CameraTile";
import { useDocumentVisible } from "@/composables/useDocumentVisible";
import type { RoomCamera } from "@/models/rooms";
import { requestHaHlsUrl } from "@/services/haHls";
import { startHaWebRtcStream, type WebRtcSession } from "@/services/haWebRtc";

export type CameraPreviewState = "off" | "connecting" | "playing";
const webRtcNegotiationTimeoutMs = 20_000;
const webRtcFirstFrameTimeoutMs = 30_000;
const videoStallTimeoutMs = 12_000;
const hlsTimeoutMs = 25_000;
type PreviewEvents = Record<"playing" | "waiting" | "error", (transport: CameraTransport) => void>;

export default defineComponent({
  name: "RoomCamera",
  props: {
    // SAFETY: Vue checks the object prop; the page supplies the typed RoomCamera model.
    camera: { type: Object as PropType<RoomCamera>, required: true },
    height: { type: Number, default: 150 },
    livePreview: { type: Boolean, default: false },
    hlsFallbackDelayMs: { type: Number, default: undefined },
  },
  emits: ["previewState"],
  setup(props, { emit }) {
    const expanded = ref(false);
    const visible = useDocumentVisible();
    const stream = shallowRef<MediaStream | null>(null);
    const hlsUrl = ref("");
    const previewState = ref<CameraPreviewState>("off");
    const activeTransport = ref<CameraTransport | null>(null);
    let previewEvents: PreviewEvents | undefined;

    watch(previewState, (state) => emit("previewState", state));
    watch(
      () => props.camera.id,
      () => {
        expanded.value = false;
      },
    );

    watch(
      () => (props.livePreview && props.camera.available && visible.value ? props.camera.id : null),
      (entityId, _, onCleanup) => {
        if (!entityId) return;
        let session: WebRtcSession | null = null;
        let webRtcAttempts = 0;
        let webRtcRunning = false;
        let hlsRunning = false;
        let hlsTried = false;
        let hlsGeneration = 0;
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
        const deadlines: Partial<Record<CameraTransport, ReturnType<typeof setTimeout>>> = {};
        const isRunning = (source: CameraTransport) =>
          source === "webrtc" ? webRtcRunning : hlsRunning;

        const stopWebRtc = () => {
          webRtcRunning = false;
          clearTimeout(deadlines.webrtc);
          clearTimeout(fallbackTimer);
          session?.stop();
          session = null;
          stream.value = null;
        };
        const stopHls = () => {
          hlsRunning = false;
          hlsGeneration++;
          clearTimeout(deadlines.hls);
          hlsUrl.value = "";
        };

        const fail = (source: CameraTransport) => {
          if (!isRunning(source)) return;
          if (source === "webrtc") stopWebRtc();
          else {
            hlsTried = true;
            stopHls();
          }
          if (activeTransport.value === source) activeTransport.value = null;
          if (webRtcRunning || hlsRunning) return;
          if (!hlsTried) startHls();
          else if (webRtcAttempts < 2) startWebRtc();
          else previewState.value = "off";
        };
        const setDeadline = (source: CameraTransport, timeout: number) => {
          clearTimeout(deadlines[source]);
          deadlines[source] = setTimeout(() => fail(source), timeout);
        };

        const startHls = () => {
          if (hlsRunning || hlsTried) return;
          hlsRunning = true;
          previewState.value = "connecting";
          const current = ++hlsGeneration;
          setDeadline("hls", hlsTimeoutMs);
          void requestHaHlsUrl(entityId)
            .then((url) => {
              if (current !== hlsGeneration) return;
              if (url) hlsUrl.value = url;
              else fail("hls");
            })
            .catch(() => {
              if (current === hlsGeneration) fail("hls");
            });
        };
        const startWebRtc = () => {
          webRtcRunning = true;
          previewState.value = "connecting";
          const attempt = ++webRtcAttempts;
          const isCurrent = () => webRtcRunning && webRtcAttempts === attempt;
          setDeadline("webrtc", webRtcNegotiationTimeoutMs);
          const started = startHaWebRtcStream(entityId, {
            onStream: (incoming) => {
              if (!isCurrent()) return;
              if (!stream.value) {
                // Negotiation can finish before the browser receives a decodable video frame.
                setDeadline("webrtc", webRtcFirstFrameTimeoutMs);
              }
              stream.value = incoming;
            },
            onError: () => {
              if (isCurrent()) fail("webrtc");
            },
          });
          if (!isCurrent()) started?.stop();
          else if (!started) fail("webrtc");
          else session = started;
        };

        previewEvents = {
          playing: (source) => {
            if (
              !isRunning(source) ||
              (activeTransport.value === source && previewState.value === "playing")
            ) {
              return;
            }
            clearTimeout(deadlines[source]);
            clearTimeout(fallbackTimer);
            if (source === "webrtc") stopHls();
            else {
              hlsTried = true;
              stopWebRtc();
            }
            activeTransport.value = source;
            previewState.value = "playing";
          },
          waiting: (source) => {
            if (activeTransport.value !== source || previewState.value !== "playing") return;
            previewState.value = "connecting";
            setDeadline(source, videoStallTimeoutMs);
          },
          error: fail,
        };
        onCleanup(() => {
          previewEvents = undefined;
          stopWebRtc();
          stopHls();
          activeTransport.value = null;
          previewState.value = "off";
        });
        startWebRtc();
        if (webRtcRunning && props.hlsFallbackDelayMs !== undefined) {
          fallbackTimer = setTimeout(startHls, props.hlsFallbackDelayMs);
        }
      },
      { immediate: true },
    );

    return () => (
      <>
        <CameraTile
          name={props.camera.name}
          note={
            previewState.value === "connecting"
              ? "Connecting…"
              : props.camera.available
                ? props.camera.snapshotUrl
                  ? ""
                  : "Snapshot unavailable"
                : "Camera offline"
          }
          imageUrl={props.camera.available ? props.camera.snapshotUrl : undefined}
          height={props.height}
          videoPreview={previewState.value !== "off"}
          videoStream={stream.value}
          hlsUrl={hlsUrl.value}
          activeTransport={activeTransport.value}
          live={previewState.value === "playing"}
          onPlaying={(source: CameraTransport) => previewEvents?.playing(source)}
          onWaiting={(source: CameraTransport) => previewEvents?.waiting(source)}
          onVideoError={(source: CameraTransport) => previewEvents?.error(source)}
          onSelect={() => {
            expanded.value = true;
          }}
        />
        {expanded.value && (
          <CameraModal
            camera={{
              id: props.camera.id,
              name: props.camera.name,
              live: props.camera.available,
              entityId: props.camera.available ? props.camera.id : undefined,
              snapshotUrl: props.camera.available ? props.camera.snapshotUrl : undefined,
            }}
            previewStream={
              previewState.value === "off"
                ? undefined
                : activeTransport.value === "hls"
                  ? null
                  : stream.value
            }
            previewHlsUrl={activeTransport.value === "hls" || !stream.value ? hlsUrl.value : ""}
            onClose={() => {
              expanded.value = false;
            }}
          />
        )}
      </>
    );
  },
});
