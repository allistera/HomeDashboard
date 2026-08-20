import { onScopeDispose, ref, type Ref } from "vue";

export function formatClock(date: Date): string {
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const day = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  return `${time} · ${day}`;
}

export function msUntilNextMinute(date: Date): number {
  const elapsed = date.getSeconds() * 1000 + date.getMilliseconds();
  return elapsed === 0 ? 60_000 : 60_000 - elapsed;
}

export function useClock(): Ref<string> {
  const clock = ref(formatClock(new Date()));
  let timer: ReturnType<typeof setTimeout>;

  const schedule = () => {
    timer = setTimeout(() => {
      clock.value = formatClock(new Date());
      schedule();
    }, msUntilNextMinute(new Date()));
  };

  schedule();
  onScopeDispose(() => clearTimeout(timer));
  return clock;
}
