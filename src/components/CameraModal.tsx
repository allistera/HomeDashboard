import { defineComponent, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from "vue";

import { useDocumentVisible } from "@/composables/useDocumentVisible";
import type { Camera } from "@/stores/security";

export default defineComponent({
  name: "CameraModal",
  props: {
    // SAFETY: Vue's runtime Object constructor is narrowed to the Camera prop shape by PropType.
    camera: { type: Object as PropType<Camera>, required: true },
  },
  emits: ["close"],
  setup(props, { emit }) {
    const pageVisible = useDocumentVisible();
    const dialog = ref<HTMLElement | null>(null);
    const streamFailed = ref(false);
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;

    const close = () => emit("close");

    const onDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const element = dialog.value;
      if (!element) return;
      const focusables = [
        ...element.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((candidate) => !candidate.hasAttribute("disabled"));
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const current = document.activeElement;
      if (!(current instanceof HTMLElement) || !element.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (current === first || current === element)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    onMounted(() => {
      document.body.style.overflow = "hidden";
      void nextTick(() => dialog.value?.focus());
    });

    onBeforeUnmount(() => {
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    });

    return () => {
      const streamAvailable = props.camera.streamUrl && !streamFailed.value && pageVisible.value;

      return (
        <div
          class="camera-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-modal-title"
          tabindex={-1}
          ref={dialog}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onKeydown={onDialogKeydown}
        >
          <div class="camera-modal__panel">
            <div class="camera-modal__head">
              <div>
                <div class="label">Camera · {streamAvailable ? "Live" : "Unavailable"}</div>
                <h2 id="camera-modal-title" class="camera-modal__title">
                  {props.camera.name}
                </h2>
              </div>
              <button
                type="button"
                class="camera-modal__close"
                aria-label="Close camera view"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 5l14 14M19 5 5 19" />
                </svg>
              </button>
            </div>
            <div class="camera-modal__viewport">
              {streamAvailable ? (
                <img
                  class="camera-modal__stream"
                  src={props.camera.streamUrl}
                  alt={`${props.camera.name} live camera enlarged`}
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onError={() => {
                    streamFailed.value = true;
                  }}
                />
              ) : (
                <div class="camera-modal__empty">
                  <span class="label">Live stream unavailable for this camera</span>
                </div>
              )}
              {props.camera.live && streamAvailable && (
                <span class="camera__tag camera__tag--live camera-modal__live">LIVE</span>
              )}
            </div>
          </div>
        </div>
      );
    };
  },
});
