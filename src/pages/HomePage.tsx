import { computed, defineComponent, ref } from "vue";
import { useRouter } from "vue-router";

import CameraModal from "@/components/CameraModal";
import CameraTile from "@/components/CameraTile";
import EventFeed from "@/components/EventFeed";
import RoomCamera, { type CameraPreviewState } from "@/components/RoomCamera";
import ToggleSwitch from "@/components/ToggleSwitch";
import TopBar from "@/components/TopBar";
import { homePageBindings } from "@/config/homeAssistant";
import { roomBindingFor } from "@/config/homeAssistant";
import { temperatureText } from "@/utils/temperature";
import { useActivityStore } from "@/stores/activity";
import { useHaStore } from "@/stores/ha";
import { useSettingsStore } from "@/stores/settings";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore, type Camera } from "@/stores/security";

export default defineComponent({
  name: "HomePage",
  setup() {
    const router = useRouter();
    const rooms = useRoomsStore();
    const activity = useActivityStore();
    const ha = useHaStore();
    const security = useSecurityStore();
    const settings = useSettingsStore();
    const selectedCamera = ref<Camera | null>(null);
    const cameraPreview = ref<CameraPreviewState>("off");
    const cameraBinding = homePageBindings.camera;
    const homeCamera = computed(() =>
      security.cameras.find((camera) =>
        security.hasLiveData
          ? camera.entityId === cameraBinding.entityId
          : camera.id === cameraBinding.demoId,
      ),
    );
    const cameraStatus = computed(() => {
      const camera = homeCamera.value;
      if (!camera?.live) return "Unavailable";
      if (!camera.entityId || cameraPreview.value === "playing") return "Live";
      return cameraPreview.value === "connecting" ? "Connecting…" : "Preview";
    });
    const mediaRoom = computed(() =>
      rooms.rooms.find((room) => room.id === homePageBindings.mediaPlayer.roomId),
    );

    const summary = computed(() => {
      const lightsOn = rooms.rooms.reduce((sum, room) => sum + rooms.lightsOn(room), 0);
      const doors =
        security.hasLiveData &&
        !security.openEntries.length &&
        !security.entries.every((entry) => entry.statusKnown)
          ? "Door status unavailable"
          : security.allSecure
            ? "Doors locked"
            : security.openEntries.length > 0
              ? security.hasLiveData
                ? "A door is open"
                : "A window is open"
              : security.hasLiveData
                ? "Doors closed"
                : "A window is open";
      return `${doors}, ${lightsOn} lights on, average indoor temperature ${temperatureText(rooms.houseTemp)}.`;
    });

    const goodNight = () => {
      rooms.setAllLights(false);
      security.arm("home");
    };
    const movie = () => {
      rooms.applyScene(homePageBindings.mediaPlayer.roomId, "relax");
    };
    const away = () => {
      rooms.setAllLights(false);
      security.arm("away");
    };

    const roomMeta = (roomId: string) => {
      const room = rooms.rooms.find((r) => r.id === roomId);
      const binding = roomBindingFor(roomId);
      if (!room || !binding) return "";

      const details: string[] = [];
      if (binding.climate || binding.temperature) details.push(temperatureText(room.temp));
      if (binding.media && room.media?.active) details.push("MEDIA ON");
      return details.join(" · ");
    };

    return () => (
      <main class="main homepage">
        <TopBar
          left={[]}
          showDate
          showPeople
          status={rooms.washingLabel}
          statusTone={rooms.washingTone}
        />

        <div class="hero">
          <div>
            <h1 class="hero__title hero__title--xl" style={{ fontSize: "34px" }}>
              Check Home Assistant for issues with devices and authentication status.
            </h1>
            <p class="hero__sub">{summary.value}</p>
          </div>
          <div class="hero__actions">
            <button
              type="button"
              class="btn btn--primary"
              disabled={settings.configured}
              onClick={goodNight}
            >
              Get Jaicob
            </button>
            <button
              type="button"
              class="btn"
              disabled={rooms.hasLiveData && !mediaRoom.value?.lights.length}
              onClick={movie}
            >
              Night Time
            </button>
            <button
              type="button"
              class="btn"
              disabled={
                rooms.hasLiveData &&
                !security.alarmAvailable &&
                !rooms.rooms.some((room) => room.lights.length > 0)
              }
              onClick={away}
            >
              Away
            </button>
          </div>
        </div>

        <div class="cols" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
          <div class="col">
            <div class="section-head">
              <span class="label">Rooms</span>
            </div>
            <div class="rows">
              {rooms.rooms
                .filter((room) => !homePageBindings.excludedRoomIds.includes(room.id))
                .map((room) => {
                  const lightsOn = rooms.lightsOn(room);
                  const on = lightsOn > 0;
                  const lightStatus =
                    lightsOn === 0
                      ? room.lights.length === 1
                        ? "Light off"
                        : "Lights off"
                      : lightsOn === 1
                        ? "Light on"
                        : `${["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][lightsOn]?.replace(/^./, (letter) => letter.toUpperCase()) ?? lightsOn} lights on`;
                  return (
                    <div
                      key={room.id}
                      class={["row", { "row--dim": !on }]}
                      style={{ gridTemplateColumns: "1fr auto" }}
                    >
                      <button
                        type="button"
                        class="room-navigation"
                        aria-label={`View ${room.name}`}
                        onClick={() => {
                          rooms.selectRoom(room.id);
                          void router.push("/rooms");
                        }}
                      >
                        <span
                          class={["row__name", { "row__name--motion": room.motion?.active }]}
                          style={{ fontSize: "30px", letterSpacing: "-0.03em" }}
                        >
                          {room.name}
                        </span>
                        <span class="row__meta">{roomMeta(room.id)}</span>
                      </button>
                      {room.lights.length > 0 && (
                        <div class="room-light-control">
                          <span class="room-light-status">{lightStatus}</span>
                          <ToggleSwitch
                            modelValue={on}
                            label={`${room.name} lights`}
                            onUpdate:modelValue={(value: boolean) =>
                              rooms.setRoomLights(room.id, value)
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div class="col-foot homepage-climate">
              <div>
                <div class="label">Target</div>
                <div class="big-number big-number--accent" style={{ fontSize: "54px" }}>
                  {temperatureText(rooms.houseTarget)}
                </div>
              </div>
              <div>
                <div class="label">Outdoor Temp</div>
                <div class="big-number" style={{ fontSize: "54px" }}>
                  {temperatureText(rooms.outsideTemp)}
                </div>
              </div>
            </div>
          </div>

          <div class="col">
            <div class="section-head" style={{ padding: "16px 40px 12px" }}>
              <span class="label">
                {cameraBinding.label} · {cameraStatus.value}
              </span>
            </div>
            <div class="homepage-camera">
              {homeCamera.value?.entityId ? (
                <RoomCamera
                  camera={{
                    id: homeCamera.value.entityId,
                    name: homeCamera.value.name,
                    available: homeCamera.value.available ?? false,
                    snapshotUrl: homeCamera.value.snapshotUrl,
                  }}
                  height={250}
                  livePreview={ha.status === "connected"}
                  onPreviewState={(state: CameraPreviewState) => {
                    cameraPreview.value = state;
                  }}
                />
              ) : (
                <CameraTile
                  name={`camera feed — ${homeCamera.value?.name ?? cameraBinding.label}`}
                  live={homeCamera.value?.live ?? false}
                  note={homeCamera.value?.note}
                  imageUrl={homeCamera.value?.snapshotUrl ?? ""}
                  height={250}
                  onSelect={() => {
                    if (homeCamera.value) selectedCamera.value = homeCamera.value;
                  }}
                />
              )}
            </div>
            <div class="section-head" style={{ padding: "20px 40px 8px" }}>
              <span class="label">Activity</span>
            </div>
            <div class="homepage-activity">
              <EventFeed
                events={activity.homepageEvents}
                emptyMessage={activity.emptyMessage}
                fit
              />
            </div>
            <div class="col-foot" style={{ padding: "18px 40px", alignItems: "center" }}>
              <div>
                <div class="label">
                  {mediaRoom.value?.media?.playing ? "Playing" : "Paused"} ·{" "}
                  {mediaRoom.value?.name ?? "Media"}
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    letterSpacing: "-0.02em",
                    marginTop: "5px",
                  }}
                >
                  {mediaRoom.value?.media?.title ?? "Nothing playing"}
                </div>
              </div>
              <div class="media-controls">
                <button
                  type="button"
                  class="media-controls__btn"
                  aria-label="Previous track"
                  disabled={rooms.hasLiveData && !mediaRoom.value?.media}
                  onClick={() =>
                    rooms.controlMedia(homePageBindings.mediaPlayer.roomId, "previous")
                  }
                >
                  ◀
                </button>
                <button
                  type="button"
                  class="media-controls__btn media-controls__btn--primary"
                  aria-label={mediaRoom.value?.media?.playing ? "Pause" : "Play"}
                  disabled={rooms.hasLiveData && !mediaRoom.value?.media}
                  onClick={() => rooms.controlMedia(homePageBindings.mediaPlayer.roomId, "toggle")}
                >
                  {mediaRoom.value?.media?.playing ? "❚❚" : "▶"}
                </button>
                <button
                  type="button"
                  class="media-controls__btn"
                  aria-label="Next track"
                  disabled={rooms.hasLiveData && !mediaRoom.value?.media}
                  onClick={() => rooms.controlMedia(homePageBindings.mediaPlayer.roomId, "next")}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
        </div>

        {selectedCamera.value && (
          <CameraModal
            camera={selectedCamera.value}
            onClose={() => {
              selectedCamera.value = null;
            }}
          />
        )}
      </main>
    );
  },
});
