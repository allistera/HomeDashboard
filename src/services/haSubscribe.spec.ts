import { describe, expect, it } from "vitest";

import { subscribeWatchedEntities } from "@/services/haSubscribe";

describe("subscribeWatchedEntities", () => {
  it("asks Home Assistant for the watched entity ids only", async () => {
    const messages: { type: string; entity_ids?: string[] }[] = [];
    const snapshots: string[][] = [];

    const unsubscribe = await subscribeWatchedEntities(
      {
        subscribeMessage: async (callback, message) => {
          messages.push(message);
          callback({
            a: {
              "light.kitchen": { s: "on", lc: 1_710_000_000 },
            },
          });
          return () => undefined;
        },
      },
      ["light.kitchen", "light.kitchen", ""],
      (entities) => {
        snapshots.push(Object.keys(entities).sort());
      },
    );

    expect(messages).toEqual([{ type: "subscribe_entities", entity_ids: ["light.kitchen"] }]);
    expect(snapshots).toEqual([["light.kitchen"]]);
    unsubscribe();
  });
});
