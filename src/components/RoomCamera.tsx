import { defineComponent, ref, shallowRef, watch, type PropType } from "vue";

import CameraModal from "@/components/CameraModal";
import CameraTile from "@/components/CameraTile";
import { useDocumentVisible } from "@/composables/useDocumentVisible";
import type { RoomCamera } from "@/models/rooms";
import { startHaWebRtcStream } from "@/services/haWebRtc";

export default defineComponent({
  name: "RoomCamera",
  props: {
    // SAFETY: Vue checks the object prop; the page supplies the typed RoomCamera model.
    camera: { type: Object as PropType<RoomCamera>, required: true },
    height: { type: Number, default: 150 },
    livePreview: { type: Boolean, default: false },
  },
  setup(props) {
    const expanded = ref(false);
    const visible = useDocumentVisible();
    const stream = shallowRef<MediaStream | null>(null);
    watch(
      () => props.camera.id,
      () => {
        expanded.value = false;
      },
    );

    watch(
      () =>
        props.livePreview && props.camera.available && visible.value && !expanded.value
          ? props.camera.id
          : null,
      (entityId, _, onCleanup) => {
        if (!entityId) return;
        const session = startHaWebRtcStream(entityId, {
          onStream: (incoming) => {
            stream.value = incoming;
          },
          onError: () => {
            stream.value = null;
          },
        });
        onCleanup(() => {
          session?.stop();
          stream.value = null;
        });
      },
      { immediate: true },
    );

    return () => (
      <>
        <CameraTile
          name={props.camera.name}
          note={
            props.camera.available
              ? props.camera.snapshotUrl
                ? ""
                : "Snapshot unavailable"
              : "Camera offline"
          }
          imageUrl={props.camera.available ? props.camera.snapshotUrl : undefined}
          height={props.height}
          videoStream={stream.value}
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
            onClose={() => {
              expanded.value = false;
            }}
          />
        )}
      </>
    );
  },
});
