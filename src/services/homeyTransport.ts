import type { CapabilityValue, HomeyConnection, HomeyDevice } from "@/services/homeyTypes";
export type CommandResult = "sent" | "failed" | "offline";

// One transport belongs to one Pinia instance; it has no dependency on application stores.
export class HomeyTransport {
  connection: HomeyConnection | null = null;
  devices = new Map<string, HomeyDevice>();
  status: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
  message = "";
  unsubscribe: (() => void) | null = null;
  generation = 0;

  async setCapability(
    deviceId: string,
    capabilityId: string,
    value: Exclude<CapabilityValue, null>,
  ): Promise<CommandResult> {
    if (!this.connection || this.status !== "connected") return "offline";
    const device = this.devices.get(deviceId);
    if (
      !device?.available ||
      !device.capabilities.includes(capabilityId) ||
      device.capabilitiesObj[capabilityId]?.setable === false
    )
      return "failed";
    try {
      await device.setCapabilityValue({ capabilityId, value });
      if (this.status === "connected") this.message = "";
      return "sent";
    } catch {
      this.message = `Homey could not update ${device.name}.`;
      return "failed";
    }
  }

  async setLight(deviceId: string, level: number): Promise<CommandResult> {
    const device = this.devices.get(deviceId);
    if (level <= 0) return this.setCapability(deviceId, "onoff", false);
    const on = await this.setCapability(deviceId, "onoff", true);
    if (on !== "sent" || !device?.capabilities.includes("dim")) return on;
    return this.setCapability(deviceId, "dim", Math.min(100, Math.max(0, level)) / 100);
  }

  cameraVideo(deviceId: string) {
    const device = this.devices.get(deviceId);
    if (!this.connection || this.status !== "connected" || !device?.available) return undefined;
    return device.videos?.find((video) => video.type === "camera")?.videoObj;
  }
}
