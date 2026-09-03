import { computed, defineComponent, ref } from "vue";

import CameraModal from "@/components/CameraModal";
import CameraTile from "@/components/CameraTile";
import EventFeed from "@/components/EventFeed";
import ToggleSwitch from "@/components/ToggleSwitch";
import TopBar from "@/components/TopBar";
import { homePageBindings, type EntityActionBinding } from "@/services/haBindings";
import { haCallService } from "@/services/haClient";
import { useActivityStore } from "@/stores/activity";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore, type Camera } from "@/stores/security";

export default defineComponent({
  name: "HomePage",
  setup() {
    const rooms = useRoomsStore();
    const activity = useActivityStore();
    const security = useSecurityStore();
    const selectedCamera = ref<Camera | null>(null);
    const homeCamera = computed(() =>
      security.cameras.find((camera) => camera.id === homePageBindings.camera.cameraId),
    );
    const mediaRoom = computed(() =>
      rooms.rooms.find((room) => room.id === homePageBindings.mediaPlayer.roomId),
    );

    const headline = computed(() => {
      if (!rooms.anyLightOn) return "Lights out.";
      const latest = activity.events[0];
      if (!latest) return "Everything's quiet.";
      return latest.text.endsWith(".") ? latest.text : `${latest.text}.`;
    });
    const headlineSize = computed(() => {
      const length = headline.value.length;
      if (length <= 20) return 76;
      if (length <= 40) return 56;
      if (length <= 65) return 44;
      if (length <= 95) return 34;
      return 26;
    });
    const summary = computed(() => {
      const lightsOn = rooms.rooms.reduce((sum, room) => sum + rooms.lightsOn(room), 0);
      const doors = security.allSecure ? "Doors locked" : "A window is open";
      return `${doors}, ${lightsOn} lights on, heating holding ${rooms.houseTemp}°.`;
    });

    const runBoundAction = (binding: EntityActionBinding) => {
      void haCallService(binding.domain, binding.service, undefined, {
        entity_id: binding.entityId,
      });
    };

    const goodNight = () => {
      rooms.setAllLights(false);
      security.arm("home");
      runBoundAction(homePageBindings.actions.goodNight);
    };
    const movie = () => {
      rooms.applyScene(homePageBindings.mediaPlayer.roomId, "relax");
      runBoundAction(homePageBindings.actions.movie);
    };
    const away = () => {
      rooms.setAllLights(false);
      security.arm("away");
      runBoundAction(homePageBindings.actions.away);
    };

    const roomMeta = (roomId: string) => {
      const room = rooms.rooms.find((r) => r.id === roomId);
      if (!room) return "";
      const on = rooms.lightsOn(room);
      const lights = on === 0 ? "OFF" : `${on} LIGHT${on === 1 ? "" : "S"}`;
      return [lights, `${room.temp.toFixed(1)}°`, room.meta].filter(Boolean).join(" · ");
    };

    return () => (
      <main class="main">
        <TopBar
          left={[`OUTSIDE ${rooms.outsideTemp.toFixed(0)}°`]}
          showPeople
          status={rooms.washingLabel}
          statusTone={rooms.washingTone}
        />

        <div class="hero">
          <div>
            <h1 class="hero__title hero__title--xl" style={{ fontSize: `${headlineSize.value}px` }}>
              {headline.value}
            </h1>
            <p class="hero__sub">{summary.value}</p>
          </div>
          <div class="hero__actions">
            <button type="button" class="btn btn--primary" onClick={goodNight}>
              Get Jaicob
            </button>
            <button type="button" class="btn" onClick={movie}>
              Movie
            </button>
            <button type="button" class="btn" onClick={away}>
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
                  const on = rooms.lightsOn(room) > 0;
                  return (
                    <div
                      key={room.id}
                      class={["row", { "row--dim": !on }]}
                      style={{
                        gridTemplateColumns: "1fr auto auto",
                        padding: "16px 0",
                      }}
                    >
                      <span
                        class="row__name"
                        style={{ fontSize: "30px", letterSpacing: "-0.03em" }}
                      >
                        {room.name}
                      </span>
                      <span class="row__meta">{roomMeta(room.id)}</span>
                      <ToggleSwitch
                        modelValue={on}
                        label={`${room.name} lights`}
                        onUpdate:modelValue={(value: boolean) =>
                          rooms.setRoomLights(room.id, value)
                        }
                      />
                    </div>
                  );
                })}
            </div>

            <div class="col-foot" style={{ padding: "20px 40px", gap: "34px" }}>
              <div>
                <div class="label">House temp</div>
                <div class="big-number" style={{ fontSize: "54px" }}>
                  {rooms.houseTemp.toFixed(1)}°
                </div>
              </div>
              <div>
                <div class="label">Target</div>
                <div class="big-number big-number--accent" style={{ fontSize: "54px" }}>
                  {rooms.houseTarget.toFixed(1)}°
                </div>
              </div>
            </div>
          </div>

          <div class="col">
            <div class="section-head" style={{ padding: "16px 40px 12px" }}>
              <span class="label">Front door · Live</span>
            </div>
            <div style={{ padding: "0 40px" }}>
              <CameraTile
                name={`camera feed — ${homeCamera.value?.name ?? "front door"}`}
                live={homeCamera.value?.live ?? false}
                note={homeCamera.value?.note}
                imageUrl={homeCamera.value?.snapshotUrl ?? ""}
                height={250}
                onSelect={() => {
                  if (homeCamera.value) selectedCamera.value = homeCamera.value;
                }}
              />
            </div>
            <div class="section-head" style={{ padding: "20px 40px 8px" }}>
              <span class="label">
                Activity{activity.status === "live" ? " · Home Assistant" : ""}
              </span>
            </div>
            <div style={{ padding: "0 40px" }}>
              <EventFeed events={activity.events.slice(0, 4)} />
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
                  onClick={() => rooms.controlMedia(homePageBindings.mediaPlayer.roomId, "toggle")}
                >
                  {mediaRoom.value?.media?.playing ? "❚❚" : "▶"}
                </button>
                <button
                  type="button"
                  class="media-controls__btn"
                  aria-label="Next track"
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
