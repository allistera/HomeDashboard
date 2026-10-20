import type { AlarmArmState } from "@/services/homeyTypes";
export type ArmState = AlarmArmState;

export interface Entry {
  id: string;
  name: string;
  kind: "door" | "window" | "garage";
  locked: boolean;
  open: boolean;
  detail: string;
}

export interface Camera {
  id: string;
  name: string;
  live: boolean;
  available?: boolean;
  note?: string;
  deviceId?: string;
  snapshotUrl?: string;
  streamUrl?: string;
}

export interface Person {
  id: string;
  name: string;
  status: string;
  color: string;
  guest?: boolean;
  home?: boolean;
}

export interface SecurityEvent {
  time: string;
  text: string;
  accent?: boolean;
}

export interface SecurityState {
  mode: "demo" | "live";
  alarmAvailable: boolean;
  armState: ArmState;
  secureSince: string;
  entries: Entry[];
  cameras: Camera[];
  people: Person[];
  events: SecurityEvent[];
}
