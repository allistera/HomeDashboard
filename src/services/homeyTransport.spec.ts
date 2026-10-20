import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import { HomeyTransport } from "@/services/homeyTransport";
import { TestDevice, TestHomey } from "@/services/homeyTestSupport";
import { useHomeyStore } from "@/stores/homey";

describe("Homey transport ownership", () => {
  it("isolates connections and commands between Pinia instances", async () => {
    const first = useHomeyStore(createPinia());
    const second = useHomeyStore(createPinia());
    const device = new TestDevice("light", { onoff: false, dim: 0 });
    first.transport.connection = new TestHomey([device]);
    first.transport.devices.set(device.id, device);
    first.transport.status = "connected";
    expect(second.status).toBe("disconnected");
    expect(await second.transport.setLight(device.id, 50)).toBe("offline");
    expect(device.commands).toEqual([]);
  });

  it("sends commands without application stores and reports failures", async () => {
    const device = new TestDevice("light", { onoff: false, dim: 0 });
    const transport = new HomeyTransport();
    transport.connection = new TestHomey([device]);
    transport.devices.set(device.id, device);
    transport.status = "connected";
    expect(await transport.setLight(device.id, 35)).toBe("sent");
    expect(device.commands).toEqual([
      { capabilityId: "onoff", value: true },
      { capabilityId: "dim", value: 0.35 },
    ]);
    device.failWrites = true;
    expect(await transport.setLight(device.id, 0)).toBe("failed");
    expect(transport.message).toContain(device.name);
  });
});
