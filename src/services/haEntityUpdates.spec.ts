import { describe, expect, it } from "vitest";

import { applyCompressedEntityUpdates } from "@/services/haEntityUpdates";

describe("applyCompressedEntityUpdates", () => {
  it("adds, updates, and removes entities from a subscribe_entities payload", () => {
    const added = applyCompressedEntityUpdates(
      {},
      {
        a: {
          "light.kitchen": {
            s: "on",
            a: { brightness: 128 },
            lc: 1_710_000_000,
            lu: 1_710_000_000,
            c: "ctx-1",
          },
        },
      },
    );

    expect(added["light.kitchen"]?.state).toBe("on");
    expect(added["light.kitchen"]?.attributes.brightness).toBe(128);
    expect(added["light.kitchen"]?.context.id).toBe("ctx-1");

    const changed = applyCompressedEntityUpdates(added, {
      c: {
        "light.kitchen": {
          "+": { s: "off", a: { brightness: 0 } },
        },
      },
    });

    expect(changed["light.kitchen"]?.state).toBe("off");
    expect(changed["light.kitchen"]?.attributes.brightness).toBe(0);
    expect(added["light.kitchen"]?.state).toBe("on");

    const removed = applyCompressedEntityUpdates(changed, { r: ["light.kitchen"] });
    expect(removed["light.kitchen"]).toBeUndefined();
  });

  it("ignores diffs for entities that were never added", () => {
    const next = applyCompressedEntityUpdates({}, { c: { "light.missing": { "+": { s: "on" } } } });
    expect(next).toEqual({});
  });
});
