import { describe, expect, it } from "vitest";

import { activityEventFromHa, subscribeHaActivity } from "@/services/haActivity";

describe("Home Assistant activity", () => {
  it("turns logbook entries into filterable feed events", () => {
    const event = activityEventFromHa({
      when: 1_757_000_000,
      entity_id: "lock.front_door",
      domain: "lock",
      state: "unlocked",
      context_id: "context-1",
    });

    expect(event).toMatchObject({
      sourceId: "lock.front_door",
      sourceName: "Front Door",
      text: "Front Door unlocked",
      domain: "lock",
      accent: true,
    });
  });

  it("subscribes to the previous 24 hours of the HA logbook", async () => {
    const messages: { type: string; start_time: string; entity_ids?: string[] }[] = [];
    const batches: string[][] = [];
    let unsubscribed = false;

    const unsubscribe = await subscribeHaActivity(
      {
        subscribeMessage: async (callback, message) => {
          messages.push(message);
          callback({
            events: [
              {
                when: "2026-09-03T09:45:00Z",
                name: "Kitchen light",
                message: "turned off",
                entity_id: "light.kitchen",
              },
            ],
          });
          return () => {
            unsubscribed = true;
          };
        },
      },
      (events) => batches.push(events.map((event) => event.text)),
      ["lock.front_door", "lock.front_door", ""],
      new Date("2026-09-03T10:00:00Z"),
    );

    expect(messages).toEqual([
      {
        type: "logbook/event_stream",
        start_time: "2026-09-02T10:00:00.000Z",
        entity_ids: ["lock.front_door"],
      },
    ]);
    expect(batches).toEqual([["Kitchen light turned off"]]);
    unsubscribe();
    expect(unsubscribed).toBe(true);
  });

  it("drops malformed logbook timestamps", () => {
    expect(activityEventFromHa({ when: "not-a-date", name: "Unknown" })).toBeNull();
  });
});
