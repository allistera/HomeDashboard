import { defineComponent } from "vue";

export default defineComponent({
  name: "ToggleSwitch",
  props: {
    modelValue: { type: Boolean, required: true },
    label: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => (
      <button
        type="button"
        role="switch"
        aria-checked={props.modelValue}
        aria-label={props.label || undefined}
        class={["toggle", { "toggle--on": props.modelValue }]}
        onClick={() => emit("update:modelValue", !props.modelValue)}
      >
        <span class="toggle__knob" />
      </button>
    );
  },
});
