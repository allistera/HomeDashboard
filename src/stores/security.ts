import { demoSecurity } from "@/data/demo/security";
import { defineStore } from "pinia";

import type { ArmState, Entry, Person, SecurityState } from "@/models/security";
export type { ArmState, Entry, Camera, Person, SecurityEvent } from "@/models/security";
import { entryBindings, homePageBindings, securityPageBindings } from "@/config/homeAssistant";
import { haCallService } from "@/services/haClient";

const armModes = {
  home: { state: "armed_home", action: "alarm_arm_home" },
  away: { state: "armed_away", action: "alarm_arm_away" },
  disarmed: { state: "disarmed", action: "alarm_disarm" },
} as const;

export const useSecurityStore = defineStore("security", {
  state: (): SecurityState => structuredClone(demoSecurity),
  getters: {
    hasLiveData: (state): boolean => state.mode === "live",
    peopleAtHome(state): Person[] {
      return state.people.filter(
        (p) => !p.guest && (state.mode === "live" ? p.home === true : p.home !== false),
      );
    },
    peopleHome(): number {
      return this.peopleAtHome.length;
    },
    openEntries(state): Entry[] {
      return state.entries.filter((e) => e.open);
    },
    allSecure(state): boolean {
      if (state.mode === "live" && !state.entries.some((entry) => entry.lockAvailable))
        return false;
      return state.entries.every((e) => e.locked && !e.open);
    },
    alarmAvailable: (state): boolean => state.mode === "live" && state.alarmState !== null,
    armState(state): ArmState | null {
      if (state.alarmState === "armed_home") return "home";
      if (state.alarmState === "armed_away") return "away";
      if (state.alarmState === "disarmed") return "disarmed";
      return null;
    },
    armLabel(state): string {
      switch (state.alarmState) {
        case "armed_home":
          return "ARMED — HOME";
        case "armed_away":
          return "ARMED — AWAY";
        default:
          return state.alarmState?.replaceAll("_", " ").toUpperCase() ?? "ALARM UNAVAILABLE";
      }
    },
  },
  actions: {
    async arm(state: ArmState, source: "security" | "home-shortcut" = "security") {
      const mode = armModes[state];
      if (!this.hasLiveData) {
        this.alarmState = mode.state;
        return;
      }
      const fromHomeShortcut = source === "home-shortcut";
      const available = fromHomeShortcut ? this.homeShortcutAlarmAvailable : this.alarmAvailable;
      if (!available || this.alarmCommandPending) return;
      const alarm = fromHomeShortcut
        ? homePageBindings.alarmControlPanel
        : securityPageBindings.alarmControlPanel;
      this.alarmCommandPending = true;
      try {
        await haCallService(alarm, mode.action);
      } finally {
        this.alarmCommandPending = false;
      }
    },
    async setLocked(id: string, locked: boolean) {
      const entry = this.entries.find((e) => e.id === id);
      if (!entry) return;
      const lock = entryBindings.find((b) => b.entryId === id)?.lock;
      if (this.hasLiveData && (!lock || !entry.lockAvailable)) return;
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

      if (!this.hasLiveData || !lock) return;
      const result = await haCallService(lock, locked ? "lock" : "unlock");
      if (result !== "sent") {
        entry.locked = previousLocked;
        entry.detail = previousDetail;
      }
    },
  },
});
