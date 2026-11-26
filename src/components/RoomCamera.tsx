import { defineComponent, ref, shallowRef, watch, type PropType } from "vue";

import CameraModal from "@/components/CameraModal";
import CameraTile from "@/components/CameraTile";
import { useDocumentVisible } from "@/composables/useDocumentVisible";
import type { RoomCamera } from "@/models/rooms";
import { startHaWebRtcStream, type WebRtcSession } from "@/services/haWebRtc";

export type CameraPreviewState = "off" | "connecting" | "playing";
const previewStartupTimeoutMs = 12_000;

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
    const previewState = ref<CameraPreviewState>("off");
    let startupTimer: ReturnType<typeof setTimeout> | undefined;

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
        let canRetry = true;
        const stop = () => {
          clearTimeout(startupTimer);
          session?.stop();
          session = null;
          stream.value = null;
        };
        const retryOrStop = () => {
          stop();
          if (canRetry) {
            canRetry = false;
            start();
          } else {
            previewState.value = "off";
          }
        };
        const start = () => {
          previewState.value = "connecting";
          session = startHaWebRtcStream(entityId, {
            onStream: (incoming) => {
              stream.value = incoming;
            },
            onError: retryOrStop,
          });
          if (session) startupTimer = setTimeout(retryOrStop, previewStartupTimeoutMs);
          else previewState.value = "off";
        };
        onCleanup(() => {
          stop();
          previewState.value = "off";
        });
        start();
      },
      { immediate: true },
    );

    const onPreviewPlaying = () => {
      if (previewState.value === "off") return;
      clearTimeout(startupTimer);
      previewState.value = "playing";
    };

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
          live={previewState.value === "playing"}
          onPlaying={onPreviewPlaying}
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
            onPlaying={onPreviewPlaying}
            onClose={() => {
              expanded.value = false;
            }}
          />
        )}
      </>
    );
  },
});
