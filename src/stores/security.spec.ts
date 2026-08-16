import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useSecurityStore } from "@/stores/security";

describe("security store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts armed for home with the studio window open", () => {
    const security = useSecurityStore();
    expect(security.armState).toBe("home");
    expect(security.armLabel).toBe("ARMED — HOME");
    expect(security.openEntries.map((e) => e.id)).toEqual(["studio-window"]);
    expect(security.allSecure).toBe(false);
  });

  it("changes arm state", () => {
    const security = useSecurityStore();
    security.arm("away");
    expect(security.armLabel).toBe("ARMED — AWAY");
    security.arm("disarmed");
    expect(security.armLabel).toBe("DISARMED");
  });

  it("locking an open entry also closes it", () => {
    const security = useSecurityStore();
    security.setLocked("studio-window", true);
    expect(security.openEntries).toHaveLength(0);
    expect(security.allSecure).toBe(true);
  });

  it("unlocking an entry updates its detail line", () => {
    const security = useSecurityStore();
    security.setLocked("front-door", false);
    const frontDoor = security.entries.find((e) => e.id === "front-door")!;
    expect(frontDoor.locked).toBe(false);
    expect(frontDoor.detail).toBe("UNLOCKED · JUST NOW");
  });

  it("counts residents but not guests as people home", () => {
    const security = useSecurityStore();
    expect(security.peopleHome).toBe(3);
  });
});
