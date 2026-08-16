import { computed, defineComponent } from "vue";

import CameraTile from "@/components/CameraTile";
import EventFeed from "@/components/EventFeed";
import ToggleSwitch from "@/components/ToggleSwitch";
import TopBar from "@/components/TopBar";
import { useSecurityStore, type ArmState } from "@/stores/security";

const armOptions: { id: ArmState; name: string }[] = [
  { id: "home", name: "Armed — home" },
  { id: "away", name: "Away" },
  { id: "disarmed", name: "Disarm" },
];

export default defineComponent({
  name: "SecurityPage",
  setup() {
    const security = useSecurityStore();

    const headline = computed(() =>
      security.armState === "disarmed"
        ? "Perimeter disarmed"
        : `Secure since ${security.secureSince}`,
    );
    const subline = computed(() => {
      const open = security.openEntries;
      if (open.length === 0) {
        return "All five locks engaged and every window closed. Motion sensors are live downstairs only while people are home.";
      }
      const names = open.map((e) => e.name.toLowerCase()).join(", ");
      return `All five locks engaged and every window closed except the ${names}, which is open by choice. Motion sensors are live downstairs only while people are home.`;
    });

    return () => (
      <main class="main">
        <TopBar
          left={["7:42 PM · THU", `${security.cameras.length} CAMERAS · 9 SENSORS`]}
          right={[`${security.peopleHome} PEOPLE HOME`]}
          status={security.armLabel}
        />

        <div class="hero" style={{ padding: "30px 40px 24px" }}>
          <div>
            <div class="label">Perimeter</div>
            <h1 class="hero__title" style={{ fontSize: "58px" }}>
              {headline.value}
            </h1>
            <p class="hero__sub" style={{ fontSize: "16px", marginTop: "12px" }}>
              {subline.value}
            </p>
          </div>
          <div class="hero__actions">
            {armOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                class={["btn", { "btn--primary": security.armState === option.id }]}
                onClick={() => security.arm(option.id)}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>

        <div class="cols" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div class="col">
            <div class="section-head">
              <span class="label">Cameras · Live</span>
              <span class="label" style={{ letterSpacing: "normal" }}>
                RECORDING ON MOTION
              </span>
            </div>
            <div
              style={{
                padding: "0 40px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              {security.cameras.map((camera) => (
                <CameraTile
                  key={camera.id}
                  name={camera.name}
                  live={camera.live}
                  note={camera.note}
                />
              ))}
            </div>

            <div class="section-head" style={{ padding: "22px 40px 10px" }}>
              <span class="label">Doors, windows & locks</span>
            </div>
            <div class="rows">
              {security.entries.map((entry) => (
                <div
                  key={entry.id}
                  class={["row", { "row--flagged": entry.open }]}
                  style={{
                    gridTemplateColumns: "1fr auto auto",
                    padding: "11px 0",
                  }}
                >
                  <span class="row__name">{entry.name}</span>
                  <span class="row__meta">{entry.detail}</span>
                  <ToggleSwitch
                    modelValue={entry.locked}
                    label={`${entry.name} lock`}
                    onUpdate:modelValue={(value: boolean) => security.setLocked(entry.id, value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div class="col">
            <div class="section-head" style={{ padding: "16px 36px 10px" }}>
              <span class="label">Who's home</span>
            </div>
            <div class="rows" style={{ padding: "0 36px" }}>
              {security.people.map((person) => (
                <div
                  key={person.id}
                  class="row"
                  style={{ gridTemplateColumns: "1fr auto", padding: "13px 0" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div class="avatar" style={{ background: person.color }} />
                    <span
                      style={{
                        fontSize: "17px",
                        color: person.guest ? "var(--label)" : "inherit",
                      }}
                    >
                      {person.name}
                    </span>
                  </div>
                  <span
                    class="row__meta"
                    style={{ color: person.guest ? "var(--label)" : undefined }}
                  >
                    {person.status}
                  </span>
                </div>
              ))}
            </div>

            <div class="section-head" style={{ padding: "22px 36px 8px" }}>
              <span class="label">Events · Today</span>
            </div>
            <div style={{ padding: "0 36px" }}>
              <EventFeed events={security.events} />
            </div>

            <div class="col-foot">
              <div>
                <div class="label">Night routine · 11:00 PM</div>
                <div
                  style={{
                    fontSize: "20px",
                    letterSpacing: "-0.02em",
                    marginTop: "6px",
                  }}
                >
                  Lock everything, arm the perimeter
                </div>
              </div>
              <button type="button" class="btn btn--small">
                Edit
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  },
});
