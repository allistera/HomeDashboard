import { defineComponent, ref, watch, type PropType } from "vue";
import LightColourPicker from "@/components/LightColourPicker";
import ToggleSwitch from "@/components/ToggleSwitch";
import type { LightColourSetting, Room } from "@/models/rooms";
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
    const expandedLightId = ref<string | null>(null);
    let opener: HTMLButtonElement | null = null;
    const closePicker = () => {
      expandedLightId.value = null;
      opener?.focus();
      opener = null;
    };
    watch(
      () => props.room.id,
      () => {
        expandedLightId.value = null;
        opener = null;
      },
    );

    return () => {
      const room = props.room;
      return (
        <>
          <div class="section-head">
            <span class="label">Lights</span>
          </div>
          <div class="rows room-lights">
            {room.lights.map((light) => {
              const pickerId = `light-colour-${room.id}-${light.id}`;
              const open = expandedLightId.value === light.id;
              const swatch = light.colour?.swatch;
              return (
                <div class="room-light-group" key={light.id}>
                  <div class={["row", "room-light", { "row--dim": light.level === 0 }]}>
                    <span class="row__name" style={{ fontSize: "19px" }}>
                      {light.name}
                    </span>
                    {light.colour && (
                      <button
                        type="button"
                        class={["room-light__swatch", { "room-light__swatch--unknown": !swatch }]}
                        style={{ backgroundColor: swatch }}
                        title={
                          swatch
                            ? `${light.level > 0 ? "Current colour" : "Last reported colour"} ${swatch}`
                            : "Colour not reported"
                        }
                        aria-label={`Change ${light.name} colour`}
                        aria-expanded={open}
                        aria-controls={open ? pickerId : undefined}
                        onClick={(event) => {
                          if (open) closePicker();
                          else {
                            if (event.currentTarget instanceof HTMLButtonElement)
                              opener = event.currentTarget;
                            expandedLightId.value = light.id;
                          }
                        }}
                      />
                    )}
                    <input
                      class="brightness-slider"
                      type="range"
                      disabled={light.dimmable === false}
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
                  {open && light.colour && (
                    <LightColourPicker
                      id={pickerId}
                      lightName={light.name}
                      colour={light.colour}
                      onChange={(setting: LightColourSetting) =>
                        void rooms.setLightColour(room.id, setting, light.id)
                      }
                      onApplyRoom={(setting: LightColourSetting) =>
                        void rooms.setLightColour(room.id, setting)
                      }
                      onClose={closePicker}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    };
  },
});
