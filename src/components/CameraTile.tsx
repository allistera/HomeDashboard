import { defineComponent, ref, watch } from "vue";

export default defineComponent({
  name: "CameraTile",
  props: {
    name: { type: String, required: true },
    live: { type: Boolean, default: false },
    note: { type: String, default: "" },
    streamUrl: { type: String, default: "" },
    height: { type: Number, default: 126 },
  },
  emits: ["select"],
  setup(props, { emit }) {
    const streamFailed = ref(false);

    watch(
      () => props.streamUrl,
      () => {
        streamFailed.value = false;
      },
    );

    return () => (
      <button
        type="button"
        class="camera"
        style={{ height: `${props.height}px` }}
        aria-label={`Open ${props.name} camera in larger view`}
        aria-haspopup="dialog"
        onClick={() => emit("select")}
      >
        {props.streamUrl !== "" && !streamFailed.value && (
          <img
            class="camera__stream"
            src={props.streamUrl}
            alt={`${props.name} live camera`}
            referrerpolicy="no-referrer"
            onError={() => {
              streamFailed.value = true;
            }}
          />
        )}
        <span class="camera__tag">{props.name}</span>
        {props.live && props.streamUrl !== "" && !streamFailed.value && (
          <span class="camera__tag camera__tag--live">LIVE</span>
        )}
        {(props.note || streamFailed.value) && (
          <span class="camera__tag">{streamFailed.value ? "STREAM UNAVAILABLE" : props.note}</span>
        )}
      </button>
    );
  },
});
