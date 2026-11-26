import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

import TopBar from "@/components/TopBar";
import { disconnectHa } from "@/services/haClient";
import { applyEntities } from "@/services/haSync";
import { entity, entityStates } from "@/services/haTestSupport";
import { useHaStore } from "@/stores/ha";

describe("Home Assistant status and presence", () => {
  let pinia: Pinia;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("shows the reason for a lost connection and clears the notice on recovery", async () => {
    const wrapper = mount(TopBar, {
      props: { left: [], status: "OK" },
      global: { plugins: [pinia] },
    });
    try {
      expect(wrapper.get('[role="alert"]').text()).toContain("Home Assistant is not connected.");
      const ha = useHaStore();
      ha.status = "connecting";
      ha.message = "Connection lost. Reconnecting…";
      await nextTick();
      expect(wrapper.get('[role="alert"]').text()).toContain("Connection lost. Reconnecting");
      ha.status = "connected";
      ha.message = "";
      await nextTick();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("counts only known household members and clears live presence on disconnect", async () => {
    const home = entity("person.allister_antosik", "home", { friendly_name: "Allister" });
    const away = entity("person.tonnii_antosik", "not_home", { friendly_name: "Tonnii" });
    const unknown = entity("person.jaicob_antosik", "unknown", { friendly_name: "Jaicob" });
    applyEntities(entityStates(home, away, unknown, entity("person.ha_mcp", "home")));
    const wrapper = mount(TopBar, {
      props: { left: [], status: "OK", showPeople: true },
      global: { plugins: [pinia] },
    });
    try {
      expect(wrapper.text()).toContain("1 PERSON HOME");
      expect(wrapper.get('[role="tooltip"]').text()).toContain("TonniiAWAY");
      expect(wrapper.get('[role="tooltip"]').text()).toContain("JaicobUNAVAILABLE");
      expect(wrapper.text()).not.toContain("ha mcp");

      applyEntities(entityStates(unknown));
      await nextTick();
      expect(wrapper.text()).toContain("PRESENCE UNAVAILABLE");
      disconnectHa();
      await nextTick();
      expect(wrapper.text()).toContain("DEMO DATA");
    } finally {
      wrapper.unmount();
    }
  });
});
