import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useSecurityStore } from "@/stores/security";

describe("security store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts armed for home with the Jaicobs Room window open", () => {
    const security = useSecurityStore();
    expect(security.armState).toBe("home");
    expect(security.armLabel).toBe("ARMED — HOME");
    expect(security.openEntries.map((e) => e.id)).toEqual(["jaicobs-room-window"]);
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
    security.setLocked("jaicobs-room-window", true);
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
    expect(security.peopleHome).toBe(4);
  });

  it("derives the status label from the perimeter state", () => {
    const security = useSecurityStore();
    expect(security.statusLabel).toBe("PUT OUT THE WASHING");
    expect(security.statusTone).toBe("ok");

    security.setLocked("jaicobs-room-window", true);
    expect(security.statusLabel).toBe("ALL SYSTEMS OK");
    expect(security.statusTone).toBe("ok");

    security.setLocked("front-door", false);
    expect(security.statusLabel).toBe("FRONT DOOR UNLOCKED");
    expect(security.statusTone).toBe("alert");
  });

  it("flags an open door as an alert", () => {
    const security = useSecurityStore();
    const frontDoor = security.entries.find((e) => e.id === "front-door")!;
    frontDoor.open = true;
    expect(security.statusLabel).toBe("FRONT DOOR OPEN");
    expect(security.statusTone).toBe("alert");
  });
});
