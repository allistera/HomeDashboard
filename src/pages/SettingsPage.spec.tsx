import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import SettingsPage from "@/pages/SettingsPage";
import {
  HA_HOUSE_TARGET_ATTRIBUTE_KEY,
  HA_HOUSE_TARGET_ENTITY_KEY,
  HA_HOUSE_TEMP_ATTRIBUTE_KEY,
  HA_HOUSE_TEMP_ENTITY_KEY,
} from "@/stores/settings";

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lets house temperature and target use Home Assistant entity properties", () => {
    localStorage.setItem(HA_HOUSE_TEMP_ENTITY_KEY, "climate.house");
    localStorage.setItem(HA_HOUSE_TEMP_ATTRIBUTE_KEY, "current_temperature");
    localStorage.setItem(HA_HOUSE_TARGET_ENTITY_KEY, "climate.house");
    localStorage.setItem(HA_HOUSE_TARGET_ATTRIBUTE_KEY, "temperature");

    const wrapper = mount(SettingsPage, { global: { plugins: [createPinia()] } });

    expect(wrapper.get<HTMLInputElement>("#ha-house-temp-entity").element.value).toBe(
      "climate.house",
    );
    expect(wrapper.get<HTMLInputElement>("#ha-house-temp-attribute").element.value).toBe(
      "current_temperature",
    );
    expect(wrapper.get<HTMLInputElement>("#ha-house-target-entity").element.value).toBe(
      "climate.house",
    );
    expect(wrapper.get<HTMLInputElement>("#ha-house-target-attribute").element.value).toBe(
      "temperature",
    );
  });
});
