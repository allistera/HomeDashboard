import { defineStore } from "pinia";

import type { ActivityEvent } from "@/services/homeyActivity";

export type ActivityStatus = "offline" | "loading" | "live" | "error";

interface ActivityState {
  events: ActivityEvent[];
  status: ActivityStatus;
  hydratedFromHomey: boolean;
}

const seedActivity: ActivityEvent[] = [
  {
    id: "seed-front-door-unlocked",
    occurredAt: 4,
    time: "7:02",
    text: "Front door unlocked by Allister",
    sourceId: "lock.front_door",
    sourceName: "Front door",
    domain: "lock",
    accent: true,
  },
  {
    id: "seed-vacuum-docked",
    occurredAt: 3,
    time: "6:58",
    text: "Vacuum returned to dock",
    sourceId: "vacuum.downstairs",
    sourceName: "Vacuum",
    domain: "vacuum",
  },
  {
    id: "seed-package-detected",
    occurredAt: 1,
    time: "5:47",
    text: "Package detected at front door",
    sourceId: "camera.front_door",
    sourceName: "Front door camera",
    domain: "camera",
    accent: true,
  },
];

export const useActivityStore = defineStore("activity", {
  state: (): ActivityState => ({
    events: structuredClone(seedActivity),
    status: "offline",
    hydratedFromHomey: false,
  }),
  actions: {
    beginLoading() {
      this.status = "loading";
      this.hydratedFromHomey = false;
      this.events = [];
    },
    receive(events: ActivityEvent[]) {
      if (!this.hydratedFromHomey) {
        this.events = [];
        this.hydratedFromHomey = true;
      }

      const byId = new Map(this.events.map((event) => [event.id, event]));
      for (const event of events) byId.set(event.id, event);
      const seenText = new Set<string>();
      this.events = [...byId.values()]
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .filter((event) => {
          if (seenText.has(event.text)) return false;
          seenText.add(event.text);
          return true;
        })
        .slice(0, 50);
      this.status = "live";
    },
    fail() {
      this.status = "error";
    },
    disconnect() {
      this.status = "offline";
      this.hydratedFromHomey = false;
    },
  },
});
