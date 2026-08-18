import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import SettingsPage from "@/pages/SettingsPage";

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps entity selection in haBindings instead of the connection form", () => {
    const wrapper = mount(SettingsPage, { global: { plugins: [createPinia()] } });

    expect(wrapper.find("#ha-house-temp-entity").exists()).toBe(false);
    expect(wrapper.find("#ha-house-target-entity").exists()).toBe(false);
    expect(wrapper.get("#ha-url").attributes("id")).toBe("ha-url");
    expect(wrapper.get("#ha-token").attributes("id")).toBe("ha-token");
  });
});
