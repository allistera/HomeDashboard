import { computed, defineComponent, type PropType } from "vue";

import { useRoomsStore } from "@/stores/rooms";
import { formatClock, formatUkDate, useClock } from "@/composables/useClock";
import { useHaStore } from "@/stores/ha";
import { useSettingsStore } from "@/stores/settings";
import { useSecurityStore } from "@/stores/security";
import { useThemeStore } from "@/stores/theme";

export type StatusTone = "neutral" | "ok" | "alert";

export default defineComponent({
  name: "TopBar",
  props: {
    // SAFETY: `Array as PropType<T[]>` is Vue's documented pattern for typed array
    // props — the runtime validator stays `Array`, the cast only narrows the
    // compile-time element type.
    left: { type: Array as PropType<string[]>, required: true },
    // SAFETY: same Vue PropType pattern as above.
    right: { type: Array as PropType<string[]>, default: () => [] },
    status: { type: String, required: true },
    // SAFETY: same Vue PropType pattern as above.
    statusTone: { type: String as PropType<StatusTone>, default: "neutral" },
    showPeople: { type: Boolean, default: false },
    showDate: { type: Boolean, default: false },
  },
  setup(props) {
    const rooms = useRoomsStore();
    const theme = useThemeStore();
    const ha = useHaStore();
    const settings = useSettingsStore();
    const security = useSecurityStore();
    const clock = useClock();
    const presenceUnavailable = computed(
      () =>
        security.hasLiveData && security.people.every((person) => person.status === "UNAVAILABLE"),
    );
    const emptyPresenceMessage = computed(() => {
      if (security.people.length === 0 && ha.status === "connected")
        return "No person devices found.";
      if (presenceUnavailable.value || security.people.length === 0) return "Presence unavailable.";
      return "No one home.";
    });
    return () => (
      <>
        <header class="topbar">
          <div class="topbar__group">
            <span class="topbar__home">Dedridge</span>
            {rooms.mode === "demo" && <span>DEMO DATA</span>}
            <span>{formatClock(clock.value)}</span>
            {props.showDate && <span>{formatUkDate(clock.value)}</span>}
            {props.left.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div class="topbar__group">
            {props.right.map((item) => (
              <span key={item}>{item}</span>
            ))}
            {props.showPeople && (
              <span class="topbar__people" tabindex={0}>
                {presenceUnavailable.value
                  ? "PRESENCE UNAVAILABLE"
                  : `${security.peopleHome} ${security.peopleHome === 1 ? "PERSON" : "PEOPLE"} HOME`}
                <span class="topbar__popover" role="tooltip">
                  <span class="topbar__popover-box">
                    {security.peopleAtHome.map((person) => (
                      <span key={person.id} class="topbar__popover-row">
                        <span class="topbar__popover-dot" style={{ background: person.color }} />
                        <span>{person.name}</span>
                        <span class="topbar__popover-status">{person.status}</span>
                      </span>
                    ))}
                    {security.peopleAtHome.length === 0 && (
                      <span class="topbar__popover-row">{emptyPresenceMessage.value}</span>
                    )}
                  </span>
                </span>
              </span>
            )}
            <span class={["topbar__status", `topbar__status--${props.statusTone}`]}>
              ● {props.status}
            </span>
            <button
              type="button"
              class="topbar__theme"
              onClick={() => theme.cycle()}
              aria-label={`Theme: ${theme.mode}. Click to change.`}
            >
              {theme.mode.toUpperCase()}
            </button>
          </div>
        </header>
        {(ha.message || ha.status === "error" || ha.status === "disconnected") && (
          <div class="connection-warning" role="alert">
            <strong>Home Assistant communication issue.</strong>{" "}
            {ha.message ||
              (settings.configured ? (
                "Unable to communicate with Home Assistant. Check your connection and Home Assistant settings."
              ) : (
                <>
                  Home Assistant is not connected.{" "}
                  <a href={`${import.meta.env.BASE_URL}settings#ha-url`}>
                    Add your Home Assistant address and access token in Settings
                  </a>
                  .
                </>
              ))}
          </div>
        )}
      </>
    );
  },
});
