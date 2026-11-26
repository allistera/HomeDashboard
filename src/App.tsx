import { defineComponent, onMounted, onBeforeUnmount, watchEffect } from "vue";
import { RouterView } from "vue-router";

import SideRail from "@/components/SideRail";
import { connectHa, disconnectHa } from "@/services/haClient";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";

export default defineComponent({
  name: "App",
  setup() {
    const theme = useThemeStore();
    const settings = useSettingsStore();

    onMounted(() => {
      if (settings.configured) void connectHa();
      theme.watchSystem();
    });
    onBeforeUnmount(disconnectHa);

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
