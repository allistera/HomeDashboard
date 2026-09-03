import { defineStore } from "pinia";

import type { AlarmArmState } from "@/services/haBindings/haGlobalBindings";
import { entryBindings, securityPageBindings } from "@/services/haBindings/haSecurityBindings";
import { haCallService } from "@/services/haClient";

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
    { id: "allister", name: "Allister", status: "ARRIVED 7:02 PM", color: "#C7CEEC" },
    { id: "tonnii", name: "Tonnii", status: "HOME ALL DAY", color: "#D8D3C4" },
    { id: "elsie", name: "Elsie", status: "ARRIVED 4:40 PM", color: "#CBD9CC" },
    { id: "jaicob", name: "Jaicob", status: "ARRIVED 3:15 PM", color: "#E7CDB8" },
  ],
  events: [
    { time: "7:02", text: "Front door unlocked · Allister" },
    { time: "6:31", text: "Patio door closed and locked" },
    { time: "5:47", text: "Package detected at front door", accent: true },
    { time: "4:40", text: "Back door unlocked · Elsie" },
    { time: "1:12", text: "Motion · driveway, 8 seconds" },
  ],
};

export const useSecurityStore = defineStore("security", {
  state: (): SecurityState => structuredClone(seedState),
  getters: {
    peopleHome(state): number {
      return state.people.filter((p) => !p.guest && p.home !== false).length;
    },
    openEntries(state): Entry[] {
      return state.entries.filter((e) => e.open);
    },
    allSecure(state): boolean {
      return state.entries.every((e) => e.locked && !e.open);
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
    async arm(state: ArmState) {
      const previous = this.armState;
      this.armState = state;
      const alarm = securityPageBindings.alarmControlPanel;
      const result = await haCallService("alarm_control_panel", alarm.services[state], undefined, {
        entity_id: alarm.entityId,
      });
      if (result === "failed") this.armState = previous;
    },
    setArmStateFromHa(state: ArmState, changedAt: string) {
      this.armState = state;
      this.secureSince = changedAt;
    },
    async setLocked(id: string, locked: boolean) {
      const entry = this.entries.find((e) => e.id === id);
      if (!entry) return;
      const lock = entryBindings.find((b) => b.entryId === id)?.lock;
      const previousLocked = entry.locked;
      const previousDetail = entry.detail;

      // Optimistic update. Locking does not close a physically open
      // door/window — the sensor entity corrects `open` on the next sync.
      entry.locked = locked;
      entry.detail = locked
        ? entry.kind === "garage"
          ? "CLOSED · LOCKED"
          : "LOCKED · JUST NOW"
        : "UNLOCKED · JUST NOW";

      if (!lock) return;
      const result = await haCallService("lock", locked ? "lock" : "unlock", undefined, {
        entity_id: lock,
      });
      if (result === "failed") {
        entry.locked = previousLocked;
        entry.detail = previousDetail;
      }
    },
  },
});
