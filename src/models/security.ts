export type ArmState = "home" | "away" | "disarmed";

export interface Entry {
  id: string;
  name: string;
  kind: "door" | "window" | "garage";
  locked: boolean;
  lockAvailable?: boolean;
  statusKnown?: boolean;
  open: boolean;
  detail: string;
}

export interface Camera {
  id: string;
  name: string;
  live: boolean;
  available?: boolean;
  note?: string;
  entityId?: string;
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
  alarmState: string | null;
  alarmCommandPending: boolean;
  homeShortcutAlarmAvailable: boolean;
  secureSince: string;
  entries: Entry[];
  cameras: Camera[];
  people: Person[];
  events: SecurityEvent[];
}
