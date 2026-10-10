import { defineComponent, nextTick, onUnmounted, ref, watch, type PropType } from "vue";
import CameraModal from "@/components/CameraModal";
import type { RoomCamera } from "@/models/rooms";
import { useSettingsStore } from "@/stores/settings";

export default defineComponent({
  name: "RoomCamera",
  props: {
    // SAFETY: Vue checks the object prop; RoomsPage supplies the typed RoomCamera model.
    camera: { type: Object as PropType<RoomCamera>, required: true },
  },
  setup(props) {
    const settings = useSettingsStore();
    const image = ref("");
    const expanded = ref(false);
    watch(
      () => props.camera.id,
      () => {
        expanded.value = false;
      },
    );
    const status = ref("Loading camera…");
    const stop = watch(
      () => [
        props.camera.id,
        props.camera.snapshotUrl,
        props.camera.available,
        settings.url,
        settings.token,
      ],
      (_, __, cleanup) => {
        const controller = new AbortController();
        let pendingUrl = "";
        let timer: ReturnType<typeof setTimeout> | undefined;
        const clearImage = () => {
          if (image.value) URL.revokeObjectURL(image.value);
          image.value = "";
        };
        clearImage();
        cleanup(() => {
          controller.abort();
          clearTimeout(timer);
          if (pendingUrl) URL.revokeObjectURL(pendingUrl);
          pendingUrl = "";
          clearImage();
        });
        if (!props.camera.available || !props.camera.snapshotUrl || !settings.configured) {
          status.value = !props.camera.available ? "Camera offline" : "Camera image unavailable";
          return;
        }
        status.value = "Loading camera…";
        const refresh = async () => {
          try {
            const base = new URL(settings.url);
            const url = new URL(props.camera.snapshotUrl!, `${base.href.replace(/\/$/, "")}/`);
            if (url.protocol !== "http:" && url.protocol !== "https:")
              throw new Error("Invalid image URL");
            const response = await fetch(url.href, {
              headers:
                url.origin === base.origin ? { Authorization: `Bearer ${settings.token}` } : {},
              credentials: "omit",
              redirect: "error",
              cache: "no-store",
              signal: controller.signal,
            });
            if (!response.ok) throw new Error("Image unavailable");
            const blob = await response.blob();
            if (!blob.type.startsWith("image/")) throw new Error("Invalid image");
            if (controller.signal.aborted) return;
            pendingUrl = URL.createObjectURL(blob);
            const nextImage = new Image();
            nextImage.src = pendingUrl;
            await nextImage.decode();
            if (controller.signal.aborted) return;
            const previousUrl = image.value;
            image.value = pendingUrl;
            pendingUrl = "";
            status.value = "Snapshot";
            await nextTick();
            if (previousUrl) URL.revokeObjectURL(previousUrl);
          } catch {
            if (controller.signal.aborted) return;
            status.value = image.value
              ? "Last snapshot · refresh unavailable"
              : "Camera image unavailable";
          } finally {
            if (pendingUrl) URL.revokeObjectURL(pendingUrl);
            pendingUrl = "";
          }
          if (!controller.signal.aborted) timer = setTimeout(refresh, 10000);
        };
        void refresh();
      },
      { immediate: true },
    );
    onUnmounted(stop);
    return () => (
      <>
        <button
          type="button"
          class="camera"
          style={{ height: "150px" }}
          aria-label={`${props.camera.name} camera`}
          aria-haspopup="dialog"
          aria-expanded={expanded.value}
          onClick={() => {
            expanded.value = true;
          }}
        >
          {image.value && (
            <img class="camera__stream" src={image.value} alt={`${props.camera.name} snapshot`} />
          )}
          <span class="camera__tag">
            {props.camera.name} · {status.value}
          </span>
        </button>
        {expanded.value && (
          <CameraModal
            camera={{
              id: props.camera.id,
              name: props.camera.name,
              live: false,
              snapshotUrl: image.value,
              note: status.value,
            }}
            onClose={() => {
              expanded.value = false;
            }}
          />
        )}
      </>
    );
  },
});
