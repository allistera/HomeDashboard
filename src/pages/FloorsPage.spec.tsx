import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import FloorsPage from "@/pages/FloorsPage";

describe("FloorsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("does not show devices that are not in the home", async () => {
    const wrapper = mount(FloorsPage);

    expect(wrapper.text()).not.toContain("Blinds");
    expect(wrapper.text()).toContain("2 STOREYS · 20 DEVICES");

    await wrapper.get("button:nth-of-type(2)").trigger("click");
    expect(wrapper.text()).not.toContain("Blinds");
  });
});
