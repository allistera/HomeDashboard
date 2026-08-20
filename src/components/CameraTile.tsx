import { defineComponent, onScopeDispose, ref, watch } from "vue";

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
  },
  emits: ["select"],
  setup(props, { emit }) {
    const streamFailed = ref(false);
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
        if (visible.value) bust.value = Date.now();
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
      () => [props.imageUrl, props.refreshMs, visible.value] as const,
      ([, , isVisible]) => {
        if (isVisible) {
          startRefresh();
        } else {
          stopRefresh();
        }
      },
      { immediate: true },
    );

    onScopeDispose(stopRefresh);

    return () => {
      const url = props.imageUrl === "" ? "" : withCacheBust(props.imageUrl, bust.value);
      const showImage = url !== "" && !streamFailed.value;
      return (
        <button
          type="button"
          class="camera"
          style={{ height: `${props.height}px` }}
          aria-label={`Open ${props.name} camera in larger view`}
          aria-haspopup="dialog"
          onClick={() => emit("select")}
        >
          {showImage && (
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
          )}
          <span class="camera__tag">{props.name}</span>
          {props.live && showImage && <span class="camera__tag camera__tag--live">LIVE</span>}
          {(props.note || streamFailed.value) && (
            <span class="camera__tag">
              {streamFailed.value ? "STREAM UNAVAILABLE" : props.note}
            </span>
          )}
        </button>
      );
    };
  },
});
