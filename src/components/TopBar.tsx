import { defineComponent, type PropType } from "vue";

import { useClock } from "@/composables/useClock";
import { useThemeStore } from "@/stores/theme";

export default defineComponent({
  name: "TopBar",
  props: {
    // SAFETY: `Array as PropType<T[]>` is Vue's documented pattern for typed array
    // props — the runtime validator stays `Array`, the cast only narrows the
    // compile-time element type.
    left: { type: Array as PropType<string[]>, required: true },
    // SAFETY: same Vue PropType pattern as above.
    right: { type: Array as PropType<string[]>, default: () => [] },
    status: { type: String, required: true },
  },
  setup(props) {
    const theme = useThemeStore();
    const clock = useClock();
    return () => (
      <header class="topbar">
        <div class="topbar__group">
          <span class="topbar__home">Dedridge</span>
          <span>{clock.value}</span>
          {props.left.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div class="topbar__group">
          {props.right.map((item) => (
            <span key={item}>{item}</span>
          ))}
          <span class="topbar__status">● {props.status}</span>
          <button
            type="button"
            class="topbar__theme"
            onClick={() => theme.toggle()}
            aria-pressed={theme.dark}
          >
            {theme.dark ? "LIGHT" : "DARK"}
          </button>
        </div>
      </header>
    );
  },
});
