import type {
  CapabilityListener,
  CapabilityValue,
  HomeyConnection,
  HomeyDevice,
} from "@/services/homeyTypes";

export class TestDevice implements HomeyDevice {
  id: string;
  name = "Test device";
  class = "speaker";
  zone = "test-zone";
  available = true;
  capabilities: string[];
  capabilitiesObj: HomeyDevice["capabilitiesObj"];
  commands: { capabilityId: string; value: Exclude<CapabilityValue, null> }[] = [];
  failWrites = false;
  failConnect = false;
  destroyed = 0;
  private callbacks = new Map<
    string,
    (value: CapabilityValue, capability: CapabilityListener) => void
  >();

  constructor(id: string, values: Record<string, CapabilityValue>) {
    this.id = id;
    this.capabilities = Object.keys(values);
    this.capabilitiesObj = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        { value, lastUpdated: "2026-10-02T12:00:00Z" },
      ]),
    );
  }

  async connect(): Promise<void> {
    if (this.failConnect) throw new Error("Unavailable");
  }

  makeCapabilityInstance(
    capabilityId: string,
    listener: (value: CapabilityValue, capability: CapabilityListener) => void,
  ): CapabilityListener {
    this.callbacks.set(capabilityId, listener);
    return {
      value: this.capabilitiesObj[capabilityId]?.value ?? null,
      lastChanged: new Date("2026-10-02T12:00:00Z"),
      destroy: () => {
        this.destroyed++;
        this.callbacks.delete(capabilityId);
      },
    };
  }

  emit(capabilityId: string, value: CapabilityValue): void {
    const listener = this.callbacks.get(capabilityId);
    listener?.(value, { value, lastChanged: new Date("2026-10-02T12:01:00Z"), destroy: () => {} });
  }

  async setCapabilityValue(options: {
    capabilityId: string;
    value: Exclude<CapabilityValue, null>;
  }): Promise<void> {
    if (this.failWrites) throw new Error("Rejected");
    this.commands.push(options);
  }
}

export class TestHomey implements HomeyConnection {
  destroyed = false;
  private events = new Map<string, (() => void)[]>();
  private deviceEvents = new Map<string, ((device: HomeyDevice) => void)[]>();
  devices: HomeyConnection["devices"];

  constructor(inventory: TestDevice[]) {
    this.devices = {
      getDevices: async () => Object.fromEntries(inventory.map((device) => [device.id, device])),
      connect: async () => {},
      on: (event, listener) => {
        this.deviceEvents.set(event, [...(this.deviceEvents.get(event) ?? []), listener]);
      },
      off: (event, listener) => {
        this.deviceEvents.set(
          event,
          (this.deviceEvents.get(event) ?? []).filter((callback) => callback !== listener),
        );
      },
    };
  }

  async connect(): Promise<void> {}
  destroy(): void {
    this.destroyed = true;
  }
  on(event: "connect" | "disconnect" | "reconnect", listener: () => void): void {
    this.events.set(event, [...(this.events.get(event) ?? []), listener]);
  }
  emit(event: "connect" | "disconnect" | "reconnect"): void {
    for (const listener of this.events.get(event) ?? []) listener();
  }
  emitDevice(event: "device.create" | "device.update" | "device.delete", device: TestDevice): void {
    for (const listener of this.deviceEvents.get(event) ?? []) listener(device);
  }
}
