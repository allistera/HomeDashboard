import { defineComponent, type PropType } from "vue";
import type { FloorPlan } from "@/data/floors";
import type { Room } from "@/models/rooms";
import { temperatureText } from "@/utils/temperature";
import "./FloorPlanCanvas.css";
type ChipTone = "active" | "attention";

export interface Chip {
  label: string;
  value: string;
  tone?: ChipTone;
  onClick?: () => void;
}

export default defineComponent({
  name: "FloorPlanCanvas",
  props: {
    // SAFETY: Vue PropType narrows the runtime Object validator to the floor contract.
    floor: { type: Object as PropType<FloorPlan>, required: true },
    // SAFETY: Vue PropType preserves the callback signature at component boundaries.
    roomById: { type: Function as PropType<(id: string) => Room | undefined>, required: true },
    // SAFETY: Vue PropType preserves the callback signature at component boundaries.
    chipsFor: { type: Function as PropType<(room: Room) => Chip[]>, required: true },
  },
  setup(props) {
    return () => (
      <div class="plan-wrap">
        <div class="plan-canvas">
          <svg viewBox="0 0 1300 800" aria-hidden="true">
            <defs>
              <pattern
                id="stair-hatch"
                patternUnits="userSpaceOnUse"
                width="12"
                height="12"
                patternTransform="rotate(60)"
              >
                <line x1="0" y1="0" x2="0" y2="12" class="plan__hatch-line" />
              </pattern>
            </defs>

            <path d={props.floor.outline} class="plan__slab" />
            <path d={props.floor.slab} class="plan__wall" fill="none" />
            <path d={props.floor.outline} class="plan__wall" fill="none" />
            {props.floor.walls.map((d, index) => (
              <path key={index} d={d} class="plan__wall" fill="none" />
            ))}

            <polygon points={props.floor.stairs} class="plan__stairs" />
            <polygon points={props.floor.stairs} fill="url(#stair-hatch)" stroke="none" />

            {props.floor.labels.map((label, index) => (
              <text key={index} x={label.x} y={label.y} class="plan__label">
                {label.text}
              </text>
            ))}

            {props.floor.callouts.map((callout) => (
              <g key={callout.roomId}>
                <path d={callout.line} class="plan__lead" fill="none" />
                <circle cx={callout.dot[0]} cy={callout.dot[1]} r="5" class="plan__dot" />
              </g>
            ))}

            {(props.floor.markers ?? []).map((marker) => (
              <g key={marker.label}>
                <path d={marker.line} class="plan__lead" fill="none" />
                <circle cx={marker.dot[0]} cy={marker.dot[1]} r="5" class="plan__dot" />
              </g>
            ))}
          </svg>

          {props.floor.callouts.map((callout) => {
            const room = props.roomById(callout.roomId);
            if (!room) return null;
            return (
              <div
                key={callout.roomId}
                class="callout"
                style={{ left: `${callout.left}%`, top: `${callout.top}%` }}
              >
                <div class="callout__head">
                  <span class="callout__name">{room.name}</span>
                  <span class="callout__temp">{temperatureText(room.temp)}</span>
                </div>
                <div class="callout__chips">
                  {props.chipsFor(room).map((chip) => {
                    const chipClass = [
                      "chip",
                      {
                        "chip--active": chip.tone === "active",
                        "chip--attention": chip.tone === "attention",
                        "chip--button": Boolean(chip.onClick),
                      },
                    ];
                    return chip.onClick ? (
                      <button
                        type="button"
                        key={chip.label}
                        class={chipClass}
                        onClick={chip.onClick}
                      >
                        <span class="chip__label">{chip.label}</span>
                        <span class="chip__value">{chip.value}</span>
                      </button>
                    ) : (
                      <div key={chip.label} class={chipClass}>
                        <span class="chip__label">{chip.label}</span>
                        <span class="chip__value">{chip.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {(props.floor.markers ?? []).map((marker) => (
            <div
              key={marker.label}
              class="callout"
              style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
            >
              <div class="callout__head">
                <span class="callout__name">{marker.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
});
