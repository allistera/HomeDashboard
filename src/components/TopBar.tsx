import { defineComponent, type PropType } from "vue";

import { useThemeStore } from "@/stores/theme";

export default defineComponent({
  name: "TopBar",
  props: {
    left: { type: Array as PropType<string[]>, required: true },
    right: { type: Array as PropType<string[]>, default: () => [] },
    status: { type: String, required: true },
  },
  setup(props) {
    const theme = useThemeStore();
    return () => (
      <header class="topbar">
        <div class="topbar__group">
          <span class="topbar__home">MAPLE STREET</span>
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
