import { defineStore } from "pinia";

import type { ActivityEvent } from "@/services/haActivity";

export type ActivityStatus = "offline" | "loading" | "live" | "error";

interface ActivityState {
  events: ActivityEvent[];
  status: ActivityStatus;
  hydratedFromHa: boolean;
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
    id: "seed-blinds-lowered",
    occurredAt: 2,
    time: "6:30",
    text: "Blinds lowered · sunset",
    sourceId: "cover.living_room_blinds",
    sourceName: "Living room blinds",
    domain: "cover",
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
    hydratedFromHa: false,
  }),
  actions: {
    beginLoading() {
      this.status = "loading";
      this.hydratedFromHa = false;
    },
    receive(events: ActivityEvent[]) {
      if (!this.hydratedFromHa) {
        this.events = [];
        this.hydratedFromHa = true;
      }

      const byId = new Map(this.events.map((event) => [event.id, event]));
      for (const event of events) byId.set(event.id, event);
      this.events = [...byId.values()]
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 50);
      this.status = "live";
    },
    fail() {
      this.status = "error";
    },
    disconnect() {
      this.status = "offline";
      this.hydratedFromHa = false;
    },
  },
});
