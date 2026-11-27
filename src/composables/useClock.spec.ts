import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

import { formatClock, formatUkDate, msUntilNextMinute, useClock } from "@/composables/useClock";

describe("formatClock", () => {
  it("formats a date as time and short uppercase weekday", () => {
    // Thursday 16 April 2026, 19:42 local time
    expect(formatClock(new Date(2026, 3, 16, 19, 42))).toBe("7:42 PM · THU");
  });

  it("formats a morning time without a leading zero", () => {
    // Monday 20 April 2026, 09:05 local time
    expect(formatClock(new Date(2026, 3, 20, 9, 5))).toBe("9:05 AM · MON");
  });
});

describe("msUntilNextMinute", () => {
  it("waits until the next minute, including when already on the minute", () => {
    expect(msUntilNextMinute(new Date(2026, 3, 16, 19, 42, 59, 0))).toBe(1000);
    expect(msUntilNextMinute(new Date(2026, 3, 16, 19, 42, 0, 0))).toBe(60_000);
    expect(msUntilNextMinute(new Date(2026, 3, 16, 19, 42, 0, 250))).toBe(59_750);
  });
});

describe("useClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks over to the next minute", () => {
    vi.setSystemTime(new Date(2026, 3, 16, 19, 42, 59));
    const scope = effectScope();
    const clock = scope.run(() => useClock())!;
    expect(formatClock(clock.value)).toBe("7:42 PM · THU");

    vi.advanceTimersByTime(1000);
    expect(formatClock(clock.value)).toBe("7:43 PM · THU");
    scope.stop();
  });

  it("does not tick every second inside the same minute", () => {
    vi.setSystemTime(new Date(2026, 3, 16, 19, 42, 0));
    const scope = effectScope();
    const clock = scope.run(() => useClock())!;

    vi.advanceTimersByTime(1000);
    expect(formatClock(clock.value)).toBe("7:42 PM · THU");
    scope.stop();
  });

  it("updates the UK date at midnight during British Summer Time", () => {
    vi.setSystemTime(new Date("2026-07-07T22:59:59Z"));
    const scope = effectScope();
    const clock = scope.run(() => useClock())!;
    expect(formatUkDate(clock.value)).toBe("07/07/2026");

    vi.advanceTimersByTime(1000);
    expect(formatUkDate(clock.value)).toBe("08/07/2026");
    scope.stop();
  });

  it("stops ticking once its scope is disposed", () => {
    vi.setSystemTime(new Date(2026, 3, 16, 19, 42, 59));
    const scope = effectScope();
    const clock = scope.run(() => useClock())!;
    scope.stop();

    vi.advanceTimersByTime(60_000);
    expect(formatClock(clock.value)).toBe("7:42 PM · THU");
  });
});
