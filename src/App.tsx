import { defineComponent, watchEffect } from "vue";
import { RouterView } from "vue-router";

import SideRail from "@/components/SideRail";
import { useThemeStore } from "@/stores/theme";

export default defineComponent({
  name: "App",
  setup() {
    const theme = useThemeStore();

    watchEffect(() => {
      if (theme.dark) {
        document.documentElement.dataset.theme = "dark";
      } else {
        delete document.documentElement.dataset.theme;
      }
    });

    return () => (
      <div class="screen">
        <SideRail />
        <RouterView />
      </div>
    );
  },
});
