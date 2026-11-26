import { defineComponent, ref, watch, type PropType } from "vue";

import CameraModal from "@/components/CameraModal";
import CameraTile from "@/components/CameraTile";
import type { RoomCamera } from "@/models/rooms";

export default defineComponent({
  name: "RoomCamera",
  props: {
    // SAFETY: Vue checks the object prop; the page supplies the typed RoomCamera model.
    camera: { type: Object as PropType<RoomCamera>, required: true },
    height: { type: Number, default: 150 },
  },
  setup(props) {
    const expanded = ref(false);
    watch(
      () => props.camera.id,
      () => {
        expanded.value = false;
      },
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
