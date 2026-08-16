import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ToggleSwitch from "@/components/ToggleSwitch";

describe("ToggleSwitch", () => {
  it("reflects its state via aria-checked and a modifier class", () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: true, label: "Lights" },
    });
    const button = wrapper.get("button");
    expect(button.attributes("aria-checked")).toBe("true");
    expect(button.attributes("aria-label")).toBe("Lights");
    expect(button.classes()).toContain("toggle--on");
  });

  it("emits the inverted value on click", async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false } });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
  });
});
