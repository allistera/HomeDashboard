import { onScopeDispose, ref, type Ref } from "vue";

export function formatClock(date: Date): string {
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const day = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  return `${time} · ${day}`;
}

export function useClock(): Ref<string> {
  const clock = ref(formatClock(new Date()));
  const timer = setInterval(() => {
    clock.value = formatClock(new Date());
  }, 1000);
  onScopeDispose(() => clearInterval(timer));
  return clock;
}
