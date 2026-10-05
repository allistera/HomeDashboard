import { defineComponent, onMounted, onBeforeUnmount, watchEffect } from "vue";
import { RouterView } from "vue-router";

import SideRail from "@/components/SideRail";
import { connectHomey, disconnectHomey } from "@/services/homeyClient";
import { applyDevices } from "@/services/homeySync";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";

export default defineComponent({
  name: "App",
  setup() {
    const theme = useThemeStore();
    const settings = useSettingsStore();

    onMounted(() => {
      if (settings.configured) void connectHomey(applyDevices);
      theme.watchSystem();
    });
    onBeforeUnmount(disconnectHomey);

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
