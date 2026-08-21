import { computed, defineComponent, nextTick, onBeforeUnmount, ref, watch } from "vue";

import { useDocumentVisible } from "@/composables/useDocumentVisible";

import CameraTile from "@/components/CameraTile";
import EventFeed from "@/components/EventFeed";
import ToggleSwitch from "@/components/ToggleSwitch";
import TopBar from "@/components/TopBar";
import { securityPageBindings } from "@/services/haBindings";
import { useSecurityStore, type ArmState, type Camera } from "@/stores/security";

const armOptions: { id: ArmState; name: string }[] = [
  { id: "home", name: "Armed — home" },
  { id: "away", name: "Away" },
  { id: "disarmed", name: "Disarm" },
];

export default defineComponent({
  name: "SecurityPage",
  setup() {
    const security = useSecurityStore();
    const pageVisible = useDocumentVisible();
    const selectedCamera = ref<Camera | null>(null);
    const cameraDialog = ref<HTMLElement | null>(null);
    const modalStreamFailed = ref(false);
    let previouslyFocused: HTMLElement | null = null;

    const openCamera = (camera: Camera) => {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      modalStreamFailed.value = false;
      selectedCamera.value = camera;
      void nextTick(() => cameraDialog.value?.focus());
    };

    const closeCamera = () => {
      selectedCamera.value = null;
      void nextTick(() => previouslyFocused?.focus());
    };

    // Keeps Tab cycling inside the dialog while the camera view is open.
    const onDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCamera();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = cameraDialog.value;
      if (!dialog) return;
      const focusables = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => !element.hasAttribute("disabled"));
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const current = document.activeElement;
      if (!(current instanceof HTMLElement) || !dialog.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    watch(selectedCamera, (camera) => {
      document.body.style.overflow = camera ? "hidden" : "";
    });

    onBeforeUnmount(() => {
      document.body.style.overflow = "";
    });

    const headline = computed(() =>
      security.armState === "disarmed"
        ? "Perimeter disarmed"
        : `Secure since ${security.secureSince}`,
    );
    const subline = computed(() => {
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
            `${security.cameras.length} CAMERAS · ${securityPageBindings.sensorCount} SENSORS`,
          ]}
          showPeople
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
                  imageUrl={camera.snapshotUrl ?? ""}
                  onSelect={() => openCamera(camera)}
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

        {selectedCamera.value && (
          <div
            class="camera-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-modal-title"
            tabindex={-1}
            ref={cameraDialog}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCamera();
            }}
            onKeydown={onDialogKeydown}
          >
            <div class="camera-modal__panel">
              <div class="camera-modal__head">
                <div>
                  <div class="label">
                    Camera ·{" "}
                    {selectedCamera.value.streamUrl && !modalStreamFailed.value && pageVisible.value
                      ? "Live"
                      : "Unavailable"}
                  </div>
                  <h2 id="camera-modal-title" class="camera-modal__title">
                    {selectedCamera.value.name}
                  </h2>
                </div>
                <button
                  type="button"
                  class="camera-modal__close"
                  aria-label="Close camera view"
                  onClick={closeCamera}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 5l14 14M19 5 5 19" />
                  </svg>
                </button>
              </div>
              <div class="camera-modal__viewport">
                {selectedCamera.value.streamUrl && !modalStreamFailed.value && pageVisible.value ? (
                  <img
                    class="camera-modal__stream"
                    src={selectedCamera.value.streamUrl}
                    alt={`${selectedCamera.value.name} live camera enlarged`}
                    decoding="async"
                    referrerpolicy="no-referrer"
                    onError={() => {
                      modalStreamFailed.value = true;
                    }}
                  />
                ) : (
                  <div class="camera-modal__empty">
                    <span class="label">Live stream unavailable for this camera</span>
                  </div>
                )}
                {selectedCamera.value.live &&
                  selectedCamera.value.streamUrl &&
                  !modalStreamFailed.value &&
                  pageVisible.value && (
                    <span class="camera__tag camera__tag--live camera-modal__live">LIVE</span>
                  )}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  },
});
