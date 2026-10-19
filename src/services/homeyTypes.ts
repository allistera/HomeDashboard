export type CapabilityValue = string | number | boolean | null;

export interface HomeyCapability {
  value: CapabilityValue;
  title?: string;
  units?: string;
  lastUpdated?: string | Date | null;
  setable?: boolean;
}

export interface CapabilityListener {
  value: CapabilityValue;
  lastChanged: Date | null;
  destroy(): void;
}

// The public SDK typings leave capabilitiesObj and createLocalAPI untyped.
// This contract describes the fields used by the dashboard, verified against
// homey-api 3.20.0's Device and DeviceCapability implementations.
export interface HomeyDevice {
  id: string;
  name: string;
  class: string;
  zone: string;
  available: boolean;
  videos?: { type: string; videoObj?: { id: string; options?: { dataChannel?: boolean } } }[];
  images?: { type?: string; id?: string; imageObj?: { url?: string } }[];
  capabilities: string[];
  capabilitiesObj: Record<string, HomeyCapability>;
  connect(): Promise<void>;
  makeCapabilityInstance(
    capabilityId: string,
    listener: (value: CapabilityValue, capability: CapabilityListener) => void,
  ): CapabilityListener;
  setCapabilityValue(options: {
    capabilityId: string;
    value: Exclude<CapabilityValue, null>;
  }): Promise<void>;
}

export interface HomeyZone {
  id: string;
  active?: boolean;
  activeLastUpdated?: string | null;
}

export interface HomeyConnection {
  flowtoken?: {
    connect(): Promise<void>;
    getFlowTokenValue(options: { id: string }): Promise<number | string | boolean | null>;
    on(event: "flowtoken.update", listener: (token: { id: string }) => void): void;
    off(event: "flowtoken.update", listener: (token: { id: string }) => void): void;
  };
  insights?: {
    getLogs(options?: { $cache: boolean }): Promise<Record<string, HomeyInsightLog>>;
  };
  zones: {
    getZones(options?: { $cache: boolean }): Promise<Record<string, HomeyZone>>;
    connect(): Promise<void>;
    on(
      event: "zone.create" | "zone.update" | "zone.delete",
      listener: (zone: HomeyZone) => void,
    ): void;
    off(
      event: "zone.create" | "zone.update" | "zone.delete",
      listener: (zone: HomeyZone) => void,
    ): void;
  };
  devices: {
    getDevices(options?: { $cache: boolean }): Promise<Record<string, HomeyDevice>>;
    connect(): Promise<void>;
    on(
      event: "device.create" | "device.update" | "device.delete",
      listener: (device: HomeyDevice) => void,
    ): void;
    off(
      event: "device.create" | "device.update" | "device.delete",
      listener: (device: HomeyDevice) => void,
    ): void;
  };
  connect(): Promise<void>;
  destroy(): void;
  on(event: "connect" | "disconnect" | "reconnect", listener: () => void): void;
}

export interface HomeyInsightLog {
  id: string;
  ownerId: string;
  ownerUri: string;
  title: string;
  type: "number" | "boolean";
  titleTrue?: string | null;
  titleFalse?: string | null;
  getEntries(): Promise<{ values: Array<{ t: string | number; v: number | boolean }> }>;
}

export type HomeyFactory = (address: string, token: string) => Promise<HomeyConnection>;

export interface DeviceCapabilityBinding {
  deviceId: string;
  capabilityId: string;
}

export interface LightBinding {
  lightId: string;
  deviceId: string;
}

export interface RoomBinding {
  roomId: string;
  name?: string;
  floor?: string;
  lights: LightBinding[];
  temperature?: DeviceCapabilityBinding;
  climate?: DeviceCapabilityBinding;
  media?: string;
  motion?: DeviceCapabilityBinding;
  vacuum?: DeviceCapabilityBinding;
}

export type AlarmArmState = "home" | "away" | "disarmed";
