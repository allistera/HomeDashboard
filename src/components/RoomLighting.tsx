import { defineComponent, type PropType } from "vue";
import ToggleSwitch from "@/components/ToggleSwitch";
import type { Room } from "@/models/rooms";
import { useRoomsStore } from "@/stores/rooms";
import "./RoomLighting.css";
export default defineComponent({
  name: "RoomLighting",
  props: {
    // SAFETY: Vue PropType narrows the runtime Object validator to a room.
    room: { type: Object as PropType<Room>, required: true },
  },
  setup(props) {
    const rooms = useRoomsStore();
    return () => {
      const room = props.room;
      return (
        <>
          <div class="section-head">
            <span class="label">Lights</span>
          </div>
          <div class="rows">
            {room.lights.map((light) => (
              <div key={light.id} class={["row", "room-light", { "row--dim": light.level === 0 }]}>
                <span class="row__name" style={{ fontSize: "19px" }}>
                  {light.name}
                </span>
                <input
                  class="brightness-slider"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={light.level}
                  aria-label={`${light.name} brightness`}
                  aria-valuetext={light.level > 0 ? `${light.level}%` : "Off"}
                  onInput={(event) => {
                    if (!(event.target instanceof HTMLInputElement)) return;
                    rooms.setLightLevel(room.id, light.id, Number(event.target.value));
                  }}
                />
                <span class="row__meta" style={{ textAlign: "right" }}>
                  {light.level > 0 ? `${light.level}%` : "OFF"}
                </span>
                <ToggleSwitch
                  modelValue={light.level > 0}
                  label={`${light.name} power`}
                  onUpdate:modelValue={(value: boolean) =>
                    rooms.setLightPower(room.id, light.id, value)
                  }
                />
              </div>
            ))}
          </div>
        </>
      );
    };
  },
});
