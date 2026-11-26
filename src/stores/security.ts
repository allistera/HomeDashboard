import { demoSecurity } from "@/data/demo/security";
import { defineStore } from "pinia";

import type { ArmState, Entry, SecurityState } from "@/models/security";
export type { ArmState, Entry, Camera, Person, SecurityEvent } from "@/models/security";
import { entryBindings, securityPageBindings } from "@/config/homeAssistant";
import { haCallService } from "@/services/haClient";

export const useSecurityStore = defineStore("security", {
  state: (): SecurityState => structuredClone(demoSecurity),
  getters: {
    hasLiveData: (state): boolean => state.mode === "live",
    peopleHome(state): number {
      return state.people.filter(
        (p) => !p.guest && (state.mode === "live" ? p.home === true : p.home !== false),
      ).length;
    },
    openEntries(state): Entry[] {
      return state.entries.filter((e) => e.open);
    },
    allSecure(state): boolean {
      if (state.mode === "live" && !state.entries.some((entry) => entry.lockAvailable))
        return false;
      return state.entries.every((e) => e.locked && !e.open);
    },
    armLabel(state): string {
      if (state.mode === "live" && !state.alarmAvailable) return "ALARM UNAVAILABLE";
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
      const alarm = securityPageBindings.alarmControlPanel;
      if (this.hasLiveData && !this.alarmAvailable) return;
      const previous = this.armState;
      this.armState = state;
      if (!this.hasLiveData) return;
      const service = { home: "alarm_arm_home", away: "alarm_arm_away", disarmed: "alarm_disarm" };
      const result = await haCallService(alarm, service[state]);
      if (result !== "sent" && this.armState === state) this.armState = previous;
    },
    setArmStateFromHa(state: ArmState, changedAt: string) {
      this.armState = state;
      this.secureSince = changedAt;
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
