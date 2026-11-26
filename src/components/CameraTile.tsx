import { defineComponent, onScopeDispose, ref, watch, watchEffect, type PropType } from "vue";

import { useDocumentVisible } from "@/composables/useDocumentVisible";

function withCacheBust(url: string, bust: number): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}time=${bust}`;
}

export default defineComponent({
  name: "CameraTile",
  props: {
    name: { type: String, required: true },
    live: { type: Boolean, default: false },
    note: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    height: { type: Number, default: 126 },
    refreshMs: { type: Number, default: 8000 },
    // SAFETY: Vue validates the object shape and RoomCamera supplies the negotiated MediaStream.
    videoStream: { type: Object as PropType<MediaStream | null>, default: null },
  },
  emits: ["select"],
  setup(props, { emit }) {
    const streamFailed = ref(false);
    const video = ref<HTMLVideoElement | null>(null);
    const visible = useDocumentVisible();
    const bust = ref(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;

    const stopRefresh = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };

    const startRefresh = () => {
      stopRefresh();
      if (props.refreshMs <= 0 || props.imageUrl === "") return;
      timer = setInterval(() => {
        if (visible.value) {
          streamFailed.value = false;
          bust.value = Date.now();
        }
      }, props.refreshMs);
    };

    watch(
      () => props.imageUrl,
      () => {
        streamFailed.value = false;
        bust.value = Date.now();
      },
    );

    watch(
      () => [props.imageUrl, props.refreshMs, visible.value, props.videoStream] as const,
      ([, , isVisible, stream]) => {
        if (isVisible && !stream) {
          startRefresh();
        } else {
          stopRefresh();
        }
      },
      { immediate: true },
    );

    watchEffect(() => {
      if (video.value) video.value.srcObject = props.videoStream;
    });

    onScopeDispose(stopRefresh);

    return () => {
      const url = props.imageUrl === "" ? "" : withCacheBust(props.imageUrl, bust.value);
      const showImage = url !== "" && !streamFailed.value;
      const note = streamFailed.value ? "STREAM UNAVAILABLE" : props.note;
      return (
        <button
          type="button"
          class="camera"
          style={{ height: `${props.height}px` }}
          aria-label={`Open ${props.name} camera in larger view`}
          aria-haspopup="dialog"
          onClick={() => emit("select")}
        >
          {props.videoStream ? (
            <video
              class="camera__stream"
              ref={video}
              autoplay
              muted
              playsinline
              aria-hidden="true"
            />
          ) : (
            showImage && (
              <img
                class="camera__stream"
                src={url}
                alt={`${props.name} camera`}
                decoding="async"
                referrerpolicy="no-referrer"
                onError={() => {
                  streamFailed.value = true;
                }}
              />
            )
          )}
          <span class="camera__tag">{props.name}</span>
          {(props.videoStream || (props.live && showImage)) && (
            <span class="camera__tag camera__tag--live">LIVE</span>
          )}
          {!props.videoStream && note && <span class="camera__tag">{note}</span>}
        </button>
      );
    };
  },
});
