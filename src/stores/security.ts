import { defineStore } from "pinia";

export type ArmState = "home" | "away" | "disarmed";

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
  note?: string;
}

export interface Person {
  id: string;
  name: string;
  status: string;
  color: string;
  guest?: boolean;
}

export interface SecurityEvent {
  time: string;
  text: string;
  accent?: boolean;
}

interface SecurityState {
  armState: ArmState;
  secureSince: string;
  entries: Entry[];
  cameras: Camera[];
  people: Person[];
  events: SecurityEvent[];
}

const seedState: SecurityState = {
  armState: "home",
  secureSince: "7:02 PM",
  entries: [
    {
      id: "front-door",
      name: "Front door",
      kind: "door",
      locked: true,
      open: false,
      detail: "LOCKED · 7:02 PM",
    },
    {
      id: "back-door",
      name: "Back door",
      kind: "door",
      locked: true,
      open: false,
      detail: "LOCKED · 5:20 PM",
    },
    {
      id: "patio-door",
      name: "Patio door",
      kind: "door",
      locked: true,
      open: false,
      detail: "LOCKED · 6:31 PM",
    },
    {
      id: "jaicobs-room-window",
      name: "Jaicobs Room window",
      kind: "window",
      locked: false,
      open: true,
      detail: "OPEN · 42 MIN",
    },
    {
      id: "garage",
      name: "Garage",
      kind: "garage",
      locked: true,
      open: false,
      detail: "CLOSED · LOCKED",
    },
  ],
  cameras: [
    { id: "front-door", name: "front door", live: true },
    { id: "driveway", name: "driveway", live: false },
    { id: "back-garden", name: "back garden", live: false },
    {
      id: "hallway",
      name: "hallway",
      live: false,
      note: "PAUSED WHILE HOME",
    },
  ],
  people: [
    { id: "mara", name: "Mara", status: "ARRIVED 7:02 PM", color: "#C7CEEC" },
    { id: "jonas", name: "Jonas", status: "HOME ALL DAY", color: "#D8D3C4" },
    { id: "elsa", name: "Elsa", status: "ARRIVED 4:40 PM", color: "#CBD9CC" },
    {
      id: "cleaner",
      name: "Cleaner · guest code",
      status: "EXPIRES FRI 12:00",
      color: "#E6E4DE",
      guest: true,
    },
  ],
  events: [
    { time: "7:02", text: "Front door unlocked · Mara" },
    { time: "6:31", text: "Patio door closed and locked" },
    { time: "5:47", text: "Package detected at front door", accent: true },
    { time: "4:40", text: "Back door unlocked · Elsa" },
    { time: "1:12", text: "Motion · driveway, 8 seconds" },
  ],
};

export const useSecurityStore = defineStore("security", {
  state: (): SecurityState => structuredClone(seedState),
  getters: {
    peopleHome(state): number {
      return state.people.filter((p) => !p.guest).length;
    },
    openEntries(state): Entry[] {
      return state.entries.filter((e) => e.open);
    },
    allSecure(state): boolean {
      return state.entries.every((e) => e.locked && !e.open);
    },
    statusLabel(state): string {
      const open = state.entries.find((e) => e.open);
      if (open) return `${open.name.toUpperCase()} OPEN`;
      const unlocked = state.entries.find((e) => !e.locked);
      if (unlocked) return `${unlocked.name.toUpperCase()} UNLOCKED`;
      return "ALL SYSTEMS OK";
    },
    armLabel(state): string {
      switch (state.armState) {
        case "home":
          return "ARMED — HOME";
        case "away":
          return "ARMED — AWAY";
        case "disarmed":
          return "DISARMED";
      }
    },
  },
  actions: {
    arm(state: ArmState) {
      this.armState = state;
    },
    setLocked(id: string, locked: boolean) {
      const entry = this.entries.find((e) => e.id === id);
      if (!entry) return;
      entry.locked = locked;
      if (locked) {
        entry.open = false;
        entry.detail = entry.kind === "garage" ? "CLOSED · LOCKED" : "LOCKED · JUST NOW";
      } else {
        entry.detail = "UNLOCKED · JUST NOW";
      }
    },
  },
});
