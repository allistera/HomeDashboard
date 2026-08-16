import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useEnergyStore } from "@/stores/energy";

describe("energy store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("defaults to the day range", () => {
    const energy = useEnergyStore();
    expect(energy.range).toBe("day");
    expect(energy.summary.usage).toBe("14.2 kWh");
  });

  it("switches range and summary together", () => {
    const energy = useEnergyStore();
    energy.setRange("month");
    expect(energy.range).toBe("month");
    expect(energy.summary.cost).toBe("£94.60");
  });

  it("exposes 24 hourly bars", () => {
    const energy = useEnergyStore();
    expect(energy.hourly).toHaveLength(24);
  });

  it("scales the live breakdown against the biggest draw", () => {
    const energy = useEnergyStore();
    expect(energy.maxDrawKw).toBe(0.82);
  });
});
