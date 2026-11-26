import { defineStore } from "pinia";

import type { ActivityEvent } from "@/services/haActivity";

export type ActivityStatus = "offline" | "loading" | "live" | "error";

interface ActivityState {
  events: ActivityEvent[];
  entityAreas: Map<string, string>;
  status: ActivityStatus;
}

const emptyMessages = {
  offline: "Connect Home Assistant to see activity.",
  loading: "Loading Home Assistant activity…",
  live: "No recent activity.",
  error: "Home Assistant activity is unavailable.",
} satisfies Record<ActivityStatus, string>;

export const useActivityStore = defineStore("activity", {
  state: (): ActivityState => ({
    events: [],
    entityAreas: new Map(),
    status: "offline",
  }),
  getters: {
    emptyMessage: (state): string => emptyMessages[state.status],
    homepageEvents: (state): ActivityEvent[] =>
      state.events.map((event) => {
        const area = state.entityAreas.get(event.sourceId);
        if (!area) return event;

        const prefix = `${area} `.toLowerCase();
        if (
          !event.sourceName.toLowerCase().startsWith(prefix) ||
          !event.text.toLowerCase().startsWith(prefix)
        ) {
          return event;
        }
        return { ...event, text: event.text.slice(prefix.length).trimStart() };
      }),
  },
  actions: {
    beginLoading() {
      this.status = "loading";
      this.events = [];
    },
    receive(events: ActivityEvent[]) {
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
  },
});
