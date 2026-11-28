import { defineComponent, ref, shallowRef, watch, type PropType } from "vue";

import CameraModal from "@/components/CameraModal";
import CameraTile from "@/components/CameraTile";
import { useDocumentVisible } from "@/composables/useDocumentVisible";
import type { RoomCamera } from "@/models/rooms";
import { requestHaHlsUrl } from "@/services/haHls";
import { startHaWebRtcStream, type WebRtcSession } from "@/services/haWebRtc";

export type CameraPreviewState = "off" | "connecting" | "playing";
const webRtcNegotiationTimeoutMs = 20_000;
const webRtcFirstFrameTimeoutMs = 30_000;
const videoStallTimeoutMs = 12_000;
const hlsTimeoutMs = 25_000;
const playbackAttempts = ["webrtc", "hls", "webrtc"] as const;

export default defineComponent({
  name: "RoomCamera",
  props: {
    // SAFETY: Vue checks the object prop; the page supplies the typed RoomCamera model.
    camera: { type: Object as PropType<RoomCamera>, required: true },
    height: { type: Number, default: 150 },
    livePreview: { type: Boolean, default: false },
  },
  emits: ["previewState"],
  setup(props, { emit }) {
    const expanded = ref(false);
    const visible = useDocumentVisible();
    const stream = shallowRef<MediaStream | null>(null);
    const hlsUrl = ref("");
    const previewState = ref<CameraPreviewState>("off");
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let retryPreview: (() => void) | undefined;

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
        let attemptIndex = 0;
        let generation = 0;
        const stop = () => {
          generation++;
          clearTimeout(startupTimer);
          session?.stop();
          session = null;
          stream.value = null;
          hlsUrl.value = "";
        };
        const start = () => {
          stop();
          const attempt = playbackAttempts[attemptIndex++];
          if (!attempt) {
            previewState.value = "off";
            return;
          }
          previewState.value = "connecting";
          const current = generation;
          const retry = () => {
            if (current === generation) start();
          };
          startupTimer = setTimeout(
            retry,
            attempt === "hls" ? hlsTimeoutMs : webRtcNegotiationTimeoutMs,
          );

          if (attempt === "hls") {
            void requestHaHlsUrl(entityId)
              .then((url) => {
                if (current !== generation) return;
                if (url) hlsUrl.value = url;
                else retry();
              })
              .catch(retry);
            return;
          }

          const started = startHaWebRtcStream(entityId, {
            onStream: (incoming) => {
              if (current !== generation) return;
              if (!stream.value) {
                // Negotiation can finish before the browser receives a decodable video frame.
                clearTimeout(startupTimer);
                startupTimer = setTimeout(retry, webRtcFirstFrameTimeoutMs);
              }
              stream.value = incoming;
            },
            onError: retry,
          });
          if (current !== generation) started?.stop();
          else if (started) session = started;
          else retry();
        };
        onCleanup(() => {
          retryPreview = undefined;
          stop();
          previewState.value = "off";
        });
        retryPreview = start;
        start();
      },
      { immediate: true },
    );

    const onPreviewPlaying = () => {
      if (previewState.value === "off") return;
      clearTimeout(startupTimer);
      previewState.value = "playing";
    };

    const onPreviewWaiting = () => {
      if (previewState.value !== "playing") return;
      previewState.value = "connecting";
      startupTimer = setTimeout(() => retryPreview?.(), videoStallTimeoutMs);
    };

    const onPreviewError = () => retryPreview?.();

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
          live={previewState.value === "playing"}
          onPlaying={onPreviewPlaying}
          onWaiting={onPreviewWaiting}
          onVideoError={onPreviewError}
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
            previewStream={previewState.value === "off" ? undefined : stream.value}
            previewHlsUrl={hlsUrl.value}
            onClose={() => {
              expanded.value = false;
            }}
          />
        )}
      </>
    );
  },
});
