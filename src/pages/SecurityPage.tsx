import { computed, defineComponent, ref } from "vue";

import CameraModal from "@/components/CameraModal";
import RoomCamera from "@/components/RoomCamera";
import CameraTile from "@/components/CameraTile";
import EventFeed from "@/components/EventFeed";
import ToggleSwitch from "@/components/ToggleSwitch";
import TopBar from "@/components/TopBar";
import { entryBindings, roomBindings } from "@/config/homeAssistant";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useSecurityStore, type ArmState, type Camera } from "@/stores/security";
import { useSettingsStore } from "@/stores/settings";

const armOptions: { id: ArmState; name: string }[] = [
  { id: "home", name: "Home" },
  { id: "away", name: "Away" },
  { id: "disarmed", name: "Disarm" },
];

export default defineComponent({
  name: "SecurityPage",
  setup() {
    const security = useSecurityStore();
    const activity = useActivityStore();
    const ha = useHaStore();
    const settings = useSettingsStore();
    const selectedCamera = ref<Camera | null>(null);

    const openCamera = (camera: Camera) => {
      selectedCamera.value = camera;
    };

    const closeCamera = () => {
      selectedCamera.value = null;
    };

    const alarmUnavailable = computed(
      () =>
        (settings.configured || security.hasLiveData) &&
        (ha.status !== "connected" || !security.alarmAvailable),
    );
    const headline = computed(() => {
      if (alarmUnavailable.value) return "Alarm unavailable";
      switch (security.alarmState) {
        case "disarmed":
          return "Perimeter disarmed";
        case "arming":
          return "Alarm arming";
        case "disarming":
          return "Alarm disarming";
        case "pending":
          return "Alarm entry delay";
        case "triggered":
          return "Alarm triggered";
        default:
          return security.alarmState?.startsWith("armed_")
            ? `Secure since ${security.secureSince}`
            : "Alarm status unknown";
      }
    });
    const subline = computed(() => {
      if (security.hasLiveData) {
        const known = security.entries.filter((entry) => entry.statusKnown);
        if (known.length === 0) return "Door and lock status unavailable.";
        const open = known.filter((entry) => entry.open);
        if (open.length > 0) return `Open: ${open.map((entry) => entry.name).join(", ")}.`;
        return known.length === security.entries.length
          ? "All monitored entries are closed."
          : "Some entry sensors are unavailable.";
      }
      const open = security.openEntries;
      const locks = `All ${security.entries.length} locks engaged`;
      if (open.length === 0) {
        return `${locks} and every window closed. Motion sensors are live downstairs only while people are home.`;
      }
      const names = open.map((e) => e.name.toLowerCase()).join(", ");
      return `${locks} and every window closed except the ${names}, which is open by choice. Motion sensors are live downstairs only while people are home.`;
    });

    return () => (
      <main class="main">
        <TopBar
          left={[
            `${security.hasLiveData ? security.cameras.filter((camera) => camera.entityId).length : security.cameras.length} CAMERAS · ${entryBindings.filter((binding) => binding.sensor).length + roomBindings.filter((binding) => binding.motion).length} SENSORS`,
          ]}
          showPeople
          status={alarmUnavailable.value ? "ALARM UNAVAILABLE" : security.armLabel}
        />

        <div class="hero" style={{ padding: "30px 40px 24px" }}>
          <div>
            <div class="label">Perimeter</div>
            <h1 class="hero__title" style={{ fontSize: "58px" }} aria-live="polite">
              {headline.value}
            </h1>
            <p class="hero__sub" style={{ fontSize: "16px", marginTop: "12px" }}>
              {subline.value}
            </p>
          </div>
          <div class="hero__actions">
            {armOptions.map((option) => {
              const active = !alarmUnavailable.value && security.armState === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  class={["btn", { "btn--primary": active }]}
                  aria-pressed={active}
                  disabled={alarmUnavailable.value || security.alarmCommandPending}
                  onClick={() => security.arm(option.id)}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        </div>

        <div class="cols" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div class="col">
            <div class="section-head">
              <span class="label">Cameras</span>
              <span class="label" style={{ letterSpacing: "normal" }}>
                {security.hasLiveData
                  ? `${security.cameras.length} CAMERAS FOUND`
                  : "RECORDING ON MOTION"}
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
              {security.hasLiveData && security.cameras.length === 0 && (
                <p class="row__meta">No cameras found in Home Assistant.</p>
              )}
              {security.cameras.map((camera) =>
                security.hasLiveData ? (
                  <RoomCamera
                    key={camera.id}
                    livePreview={ha.status === "connected"}
                    camera={{
                      id: camera.entityId ?? camera.id,
                      name: camera.name,
                      available: camera.available ?? false,
                      snapshotUrl: camera.snapshotUrl,
                    }}
                  />
                ) : (
                  <CameraTile
                    key={camera.id}
                    name={camera.name}
                    live={camera.live}
                    note={camera.note}
                    imageUrl={camera.snapshotUrl ?? ""}
                    onSelect={() => openCamera(camera)}
                  />
                ),
              )}
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
                  {(!security.hasLiveData || entry.lockAvailable) && (
                    <ToggleSwitch
                      modelValue={entry.locked}
                      label={`${entry.name} lock`}
                      onUpdate:modelValue={(value: boolean) => security.setLocked(entry.id, value)}
                    />
                  )}
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
              <span class="label">Events · {security.hasLiveData ? "Live" : "Today"}</span>
            </div>
            <div style={{ padding: "0 36px" }}>
              <EventFeed
                events={
                  security.hasLiveData
                    ? activity.events.filter((event) => event.accent)
                    : security.events
                }
              />
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

        {selectedCamera.value && (
          <CameraModal camera={selectedCamera.value} onClose={closeCamera} />
        )}
      </main>
    );
  },
});
