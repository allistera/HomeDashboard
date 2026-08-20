import { computed, defineComponent } from "vue";

import ToggleSwitch from "@/components/ToggleSwitch";
import TopBar from "@/components/TopBar";
import { useRoomsStore, type Room, type Scene } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

export default defineComponent({
  name: "RoomsPage",
  setup() {
    const rooms = useRoomsStore();
    const security = useSecurityStore();

    const listMeta = (room: Room) => {
      const on = rooms.lightsOn(room);
      const lights = on === 0 ? "OFF" : `${on} ON`;
      return [lights, `${room.temp.toFixed(1)}°`, room.meta].filter(Boolean).join(" · ");
    };

    const detailSummary = computed(() => {
      const room = rooms.selectedRoom;
      const on = rooms.lightsOn(room);
      const lights = on === 0 ? "No lights on" : `${on === 1 ? "One light" : `${on} lights`} on`;
      const blinds = room.blinds.length > 0 ? ", blinds set" : "";
      return `${lights}${blinds}, holding ${room.temp.toFixed(1)}°.`;
    });

    const scenes: { id: Scene; name: string }[] = [
      { id: "relax", name: "Relax" },
      { id: "bright", name: "Bright" },
      { id: "all-off", name: "All off" },
    ];

    return () => {
      const room = rooms.selectedRoom;
      return (
        <main class="main">
          <TopBar
            left={[`OUTSIDE ${rooms.outsideTemp.toFixed(0)}°`]}
            showPeople
            status={security.statusLabel}
            statusTone={security.statusTone}
          />

          <div class="cols" style={{ gridTemplateColumns: "296px 1fr" }}>
            <div class="col">
              <div class="section-head" style={{ padding: "16px 28px 12px" }}>
                <span class="label">{rooms.rooms.length} Rooms</span>
              </div>
              <div>
                {rooms.rooms.map((r) => {
                  const active = r.id === rooms.selectedRoomId;
                  const dim = rooms.lightsOn(r) === 0;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => rooms.selectRoom(r.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        font: "inherit",
                        color: "inherit",
                        cursor: "pointer",
                        background: active ? "var(--highlight)" : "none",
                        border: "none",
                        borderTop: "1px solid var(--hairline)",
                        borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                        padding: "16px 28px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "23px",
                          letterSpacing: "-0.03em",
                          color: dim && !active ? "var(--label)" : "inherit",
                        }}
                      >
                        {r.name}
                      </div>
                      <div class="row__meta" style={{ marginTop: "5px", fontSize: "11px" }}>
                        {listMeta(r)}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div class="col-foot" style={{ padding: "22px 28px", alignItems: "center" }}>
                <span class="label">All lights</span>
                <ToggleSwitch
                  modelValue={rooms.anyLightOn}
                  label="All lights"
                  onUpdate:modelValue={(value: boolean) => rooms.setAllLights(value)}
                />
              </div>
            </div>

            <div class="col">
              <div class="hero" style={{ padding: "36px 40px 28px" }}>
                <div>
                  <div class="label">{room.floor}</div>
                  <h1 class="hero__title">{room.name}</h1>
                  <p class="hero__sub" style={{ fontSize: "16px" }}>
                    {detailSummary.value}
                  </p>
                </div>
                <div class="hero__actions">
                  {scenes.map((scene) => (
                    <button
                      type="button"
                      key={scene.id}
                      class={["btn", "btn--small", { "btn--primary": scene.id === "relax" }]}
                      onClick={() => rooms.applyScene(room.id, scene.id)}
                    >
                      {scene.name}
                    </button>
                  ))}
                </div>
              </div>

              <div class="cols" style={{ gridTemplateColumns: "1.15fr 0.85fr" }}>
                <div class="col">
                  <div class="section-head">
                    <span class="label">Lights</span>
                  </div>
                  <div class="rows">
                    {room.lights.map((light) => (
                      <div
                        key={light.id}
                        class={["row", { "row--dim": light.level === 0 }]}
                        style={{
                          gridTemplateColumns: "1fr 120px 56px",
                          gap: "20px",
                        }}
                      >
                        <span class="row__name" style={{ fontSize: "19px" }}>
                          {light.name}
                        </span>
                        <div class="meter">
                          {light.level > 0 && (
                            <div class="meter__fill" style={{ width: `${light.level}%` }} />
                          )}
                        </div>
                        <span class="row__meta" style={{ textAlign: "right" }}>
                          {light.level > 0 ? `${light.level}%` : "OFF"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {room.blinds.length > 0 && (
                    <>
                      <div class="section-head" style={{ padding: "22px 40px 10px" }}>
                        <span class="label">Blinds</span>
                      </div>
                      <div class="rows">
                        {room.blinds.map((blind) => (
                          <div
                            key={blind.id}
                            class="row"
                            style={{
                              gridTemplateColumns: "1fr 120px 56px",
                              gap: "20px",
                            }}
                          >
                            <span class="row__name" style={{ fontSize: "19px" }}>
                              {blind.name}
                            </span>
                            <div class="meter">
                              <div
                                class="meter__fill meter__fill--accent"
                                style={{ width: `${blind.closed}%` }}
                              />
                            </div>
                            <span class="row__meta" style={{ textAlign: "right" }}>
                              {blind.closed}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div class="col-foot" style={{ padding: "20px 40px", gap: "34px" }}>
                    <div>
                      <div class="label">Room temp</div>
                      <div class="big-number">{room.temp.toFixed(1)}°</div>
                    </div>
                    <div>
                      <div class="label">Target</div>
                      <div class="big-number big-number--accent">{room.target.toFixed(1)}°</div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <button
                        type="button"
                        class="btn"
                        style={{
                          width: "42px",
                          height: "42px",
                          padding: 0,
                          fontSize: "18px",
                        }}
                        aria-label="Lower target temperature"
                        onClick={() => rooms.adjustTarget(room.id, -0.5)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        class="btn"
                        style={{
                          width: "42px",
                          height: "42px",
                          padding: 0,
                          fontSize: "18px",
                        }}
                        aria-label="Raise target temperature"
                        onClick={() => rooms.adjustTarget(room.id, 0.5)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div class="col">
                  {room.media && (
                    <>
                      <div class="section-head" style={{ padding: "16px 36px 10px" }}>
                        <span class="label">Media</span>
                      </div>
                      <div
                        style={{
                          padding: "0 36px 20px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <div class="camera" style={{ height: "150px" }}>
                          <span class="camera__tag">now playing artwork</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            marginTop: "14px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "20px",
                                letterSpacing: "-0.02em",
                              }}
                            >
                              {room.media.title}
                            </div>
                            <div class="label" style={{ marginTop: "5px" }}>
                              {room.media.output}
                            </div>
                          </div>
                          <div class="media-controls">
                            <button
                              type="button"
                              class="media-controls__btn"
                              aria-label="Previous track"
                              onClick={() => rooms.controlMedia(room.id, "previous")}
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              class="media-controls__btn media-controls__btn--primary"
                              aria-label={room.media.playing ? "Pause" : "Play"}
                              onClick={() => rooms.controlMedia(room.id, "toggle")}
                            >
                              {room.media.playing ? "❚❚" : "▶"}
                            </button>
                            <button
                              type="button"
                              class="media-controls__btn"
                              aria-label="Next track"
                              onClick={() => rooms.controlMedia(room.id, "next")}
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div class="section-head" style={{ padding: "18px 36px 8px" }}>
                    <span class="label">In this room today</span>
                  </div>
                  <div style={{ padding: "0 36px" }}>
                    <div class="events">
                      {room.events.length === 0 && (
                        <div class="event">
                          <span class="event__text" style={{ color: "var(--label)" }}>
                            Nothing yet today.
                          </span>
                        </div>
                      )}
                      {room.events.map((event) => (
                        <div key={`${event.time}-${event.text}`} class="event">
                          <span class="event__time">{event.time}</span>
                          <span class="event__text">{event.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div class="col-foot" style={{ padding: "18px 36px", alignItems: "center" }}>
                    <span class="label">
                      {room.deviceCount} devices · {room.offlineCount} offline
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      );
    };
  },
});
