import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActivityEvent } from "@/services/haActivity";
import { useActivityStore } from "@/stores/activity";

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "event-1",
    occurredAt: 100,
    time: "10:00",
    text: "Kitchen light turned on",
    sourceId: "light.kitchen",
    sourceName: "Kitchen light",
    domain: "light",
    ...overrides,
  };
}

describe("activity store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("replaces offline examples with Home Assistant activity", () => {
    const activity = useActivityStore();
    activity.beginLoading();
    activity.receive([event()]);

    expect(activity.status).toBe("live");
    expect(activity.events).toEqual([event()]);
  });

  it("merges, deduplicates and sorts streamed batches", () => {
    const activity = useActivityStore();
    activity.beginLoading();
    activity.receive([event(), event({ id: "event-2", occurredAt: 200, text: "Door opened" })]);
    activity.receive([event({ text: "Kitchen light turned off" })]);

    expect(activity.events.map((item) => item.id)).toEqual(["event-2", "event-1"]);
    expect(activity.events[1]?.text).toBe("Kitchen light turned off");
  });

  it("keeps only the newest event for duplicate feed text", () => {
    const activity = useActivityStore();
    activity.beginLoading();
    activity.receive([event(), event({ id: "event-2", occurredAt: 200, time: "10:05" })]);
    activity.receive([event({ id: "event-3", occurredAt: 300, time: "10:10" })]);

    expect(activity.events).toEqual([event({ id: "event-3", occurredAt: 300, time: "10:10" })]);
  });
});
