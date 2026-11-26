import { computed, defineComponent, ref, watch, type PropType } from "vue";

import type { HueSaturation, LightColour, LightColourSetting } from "@/models/rooms";
import { hueSaturationHex } from "@/utils/lightColour";

const hueStart = 210;
const presets: { name: string; hs: HueSaturation }[] = [
  { name: "Blue", hs: [215, 79] },
  { name: "Purple", hs: [270, 63] },
  { name: "Pink", hs: [338, 56] },
  { name: "Red", hs: [12, 85] },
  { name: "Orange", hs: [35, 80] },
  { name: "Green", hs: [111, 63] },
  { name: "Cyan", hs: [177, 75] },
];

const wrapHue = (value: number) => (value + 360) % 360;
const percentage = (value: number) => Math.min(100, Math.max(0, value));

export default defineComponent({
  name: "LightColourPicker",
  props: {
    id: { type: String, required: true },
    lightName: { type: String, required: true },
    // SAFETY: Vue checks the object prop. Home Assistant state hydration supplies the shape.
    colour: { type: Object as PropType<LightColour>, required: true },
  },
  emits: {
    change: (_setting: LightColourSetting) => true,
    applyRoom: (_setting: LightColourSetting) => true,
    close: () => true,
  },
  setup(props, { emit }) {
    const tab = ref<"colour" | "white">(props.colour.supportsColour ? "colour" : "white");
    const hs = ref<HueSaturation>([0, 0]);
    const kelvin = ref(3000);
    let activePointer: number | undefined;

    watch(
      [() => props.colour.hs?.[0], () => props.colour.hs?.[1]],
      ([hue, saturation]) => {
        if (hue !== undefined && saturation !== undefined) hs.value = [wrapHue(hue), saturation];
      },
      { immediate: true },
    );
    watch(
      [
        () => props.colour.kelvin,
        () => props.colour.temperature?.min,
        () => props.colour.temperature?.max,
      ],
      ([value, min, max]) => {
        if (min !== undefined && max !== undefined)
          kelvin.value = Math.min(max, Math.max(min, value ?? 3000));
      },
      { immediate: true },
    );

    const hex = computed(() => hueSaturationHex(hs.value));
    const whiteAvailable = computed(() => !!props.colour.temperature || props.colour.fixedWhite);

    const currentSetting = (): LightColourSetting => {
      if (tab.value === "colour") return { mode: "colour", hs: hs.value };
      if (props.colour.temperature) return { mode: "temperature", kelvin: kelvin.value };
      return { mode: "white" };
    };

    const chooseColour = (colour: HueSaturation) => {
      hs.value = colour;
      emit("change", { mode: "colour", hs: colour });
    };

    const movePointer = (event: PointerEvent) => {
      if (!(event.currentTarget instanceof HTMLElement)) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const across = percentage(((event.clientX - bounds.left) * 100) / bounds.width);
      const down = percentage(((event.clientY - bounds.top) * 100) / bounds.height);
      hs.value = [
        wrapHue(hueStart + Math.min(359, Math.round(across * 3.6))),
        Math.round(100 - down),
      ];
    };

    const moveWithKey = (event: KeyboardEvent) => {
      const [hue, saturation] = hs.value;
      const step = event.shiftKey ? 10 : 1;
      switch (event.key) {
        case "ArrowLeft":
          hs.value = [wrapHue(hue - step), saturation];
          break;
        case "ArrowRight":
          hs.value = [wrapHue(hue + step), saturation];
          break;
        case "ArrowDown":
          hs.value = [hue, percentage(saturation - step)];
          break;
        case "ArrowUp":
          hs.value = [hue, percentage(saturation + step)];
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    return () => {
      const [hue, saturation] = hs.value;
      const temperature = props.colour.temperature;
      return (
        <section
          id={props.id}
          class="colour-picker"
          aria-label={`${props.lightName} colour picker`}
          onKeydown={(event) => {
            if (event.key === "Escape") emit("close");
          }}
        >
          <div class="colour-picker__bar">
            <div class="colour-picker__modes" role="group" aria-label="Light colour mode">
              {props.colour.supportsColour && (
                <button
                  type="button"
                  class={["btn", { "btn--primary": tab.value === "colour" }]}
                  aria-pressed={tab.value === "colour"}
                  onClick={() => {
                    tab.value = "colour";
                  }}
                >
                  Colour
                </button>
              )}
              {whiteAvailable.value && (
                <button
                  type="button"
                  class={["btn", { "btn--primary": tab.value === "white" }]}
                  aria-pressed={tab.value === "white"}
                  onClick={() => {
                    tab.value = "white";
                  }}
                >
                  White
                </button>
              )}
            </div>
            <span class="colour-picker__values" id={`${props.id}-values`}>
              {tab.value === "colour" ? (
                <>
                  Hue {Math.round(hue)}° · Sat {Math.round(saturation)}%{" "}
                  <strong>{hex.value}</strong>
                </>
              ) : temperature ? (
                <strong>{kelvin.value} K</strong>
              ) : null}
            </span>
            <button
              type="button"
              class="colour-picker__close"
              aria-label="Close colour picker"
              onClick={() => emit("close")}
            >
              ×
            </button>
          </div>

          {tab.value === "colour" ? (
            <button
              type="button"
              class="colour-picker__palette"
              aria-label="Choose hue and saturation. Use the arrow keys, then press Enter to apply."
              aria-describedby={`${props.id}-values`}
              onKeydown={moveWithKey}
              onClick={(event) => {
                if (event.detail === 0) chooseColour(hs.value);
              }}
              onPointerdown={(event) => {
                if (
                  event.button !== 0 ||
                  activePointer !== undefined ||
                  !(event.currentTarget instanceof HTMLElement)
                )
                  return;
                activePointer = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                movePointer(event);
              }}
              onPointermove={(event) => {
                if (event.pointerId === activePointer) movePointer(event);
              }}
              onPointerup={(event) => {
                if (event.pointerId !== activePointer) return;
                movePointer(event);
                activePointer = undefined;
                chooseColour(hs.value);
              }}
              onLostpointercapture={() => {
                activePointer = undefined;
              }}
            >
              <span
                class="colour-picker__point"
                aria-hidden="true"
                style={{
                  left: `${wrapHue(hue - hueStart) / 3.6}%`,
                  top: `${100 - saturation}%`,
                  backgroundColor: hex.value,
                }}
              />
            </button>
          ) : temperature ? (
            <div class="colour-picker__white">
              <input
                type="range"
                aria-label="White colour temperature"
                aria-valuetext={`${kelvin.value} Kelvin`}
                min={temperature.min}
                max={temperature.max}
                value={kelvin.value}
                onInput={(event) => {
                  if (event.currentTarget instanceof HTMLInputElement)
                    kelvin.value = event.currentTarget.valueAsNumber;
                }}
                onChange={() => emit("change", currentSetting())}
              />
              <div class="colour-picker__temperature-labels">
                <span>Warm</span>
                <span>Cool</span>
              </div>
            </div>
          ) : null}

          <div class="colour-picker__bar colour-picker__footer">
            {tab.value === "colour" ? (
              <div class="colour-picker__presets" role="group" aria-label="Colour presets">
                <span class="label">Presets</span>
                {presets.map(({ name, hs: colour }) => (
                  <button
                    type="button"
                    key={name}
                    class="colour-picker__preset"
                    style={{ backgroundColor: hueSaturationHex(colour) }}
                    aria-label={name}
                    title={name}
                    onClick={() => chooseColour(colour)}
                  />
                ))}
              </div>
            ) : props.colour.fixedWhite && !temperature ? (
              <button type="button" class="btn" onClick={() => emit("change", { mode: "white" })}>
                Set white
              </button>
            ) : null}
            <button
              type="button"
              class="btn colour-picker__apply"
              onClick={() => emit("applyRoom", currentSetting())}
            >
              Apply to room
            </button>
          </div>
        </section>
      );
    };
  },
});
