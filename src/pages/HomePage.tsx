import { computed, defineComponent } from "vue";

import CameraTile from "@/components/CameraTile";
import EventFeed from "@/components/EventFeed";
import ToggleSwitch from "@/components/ToggleSwitch";
import TopBar from "@/components/TopBar";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

const tempTrend = [38, 52, 44, 66, 80, 72, 90];

export default defineComponent({
  name: "HomePage",
  setup() {
    const rooms = useRoomsStore();
    const security = useSecurityStore();

    const headline = computed(() => (rooms.anyLightOn ? "Everything's quiet." : "Lights out."));
    const summary = computed(() => {
      const lightsOn = rooms.rooms.reduce((sum, room) => sum + rooms.lightsOn(room), 0);
      const doors = security.allSecure ? "Doors locked" : "A window is open";
      return `${doors}, ${lightsOn} lights on, heating holding ${rooms.houseTemp}°. Vacuum finished the kitchen 40 minutes ago.`;
    });

    const goodNight = () => {
      rooms.setAllLights(false);
      security.arm("home");
    };
    const movie = () => rooms.applyScene("living-room", "relax");
    const away = () => {
      rooms.setAllLights(false);
      security.arm("away");
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
          left={["7:42 PM · THU", "OUTSIDE 12°"]}
          right={[`${security.peopleHome} PEOPLE HOME`]}
          status={security.allSecure ? "ALL SYSTEMS OK" : "STUDIO WINDOW OPEN"}
        />

        <div class="hero">
          <div>
            <h1 class="hero__title hero__title--xl">{headline.value}</h1>
            <p class="hero__sub">{summary.value}</p>
          </div>
          <div class="hero__actions">
            <button type="button" class="btn btn--primary" onClick={goodNight}>
              Good night
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
                .filter((room) => room.id !== "garden")
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
              <div class="bars" style={{ flex: 1, gap: "4px", height: "56px" }}>
                {tempTrend.map((height, index) => (
                  <div
                    key={index}
                    class={["bars__bar", { "bars__bar--accent": index === tempTrend.length - 1 }]}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div class="col">
            <div class="section-head" style={{ padding: "16px 40px 12px" }}>
              <span class="label">Front door · Live</span>
            </div>
            <div style={{ padding: "0 40px" }}>
              <CameraTile name="camera feed — front door" live height={250} />
            </div>
            <div class="section-head" style={{ padding: "20px 40px 8px" }}>
              <span class="label">Activity</span>
            </div>
            <div style={{ padding: "0 40px" }}>
              <EventFeed events={rooms.activity} />
            </div>
            <div class="col-foot" style={{ padding: "18px 40px", alignItems: "center" }}>
              <div>
                <div class="label">Playing · Kitchen</div>
                <div
                  style={{
                    fontSize: "20px",
                    letterSpacing: "-0.02em",
                    marginTop: "5px",
                  }}
                >
                  Evening Acoustic
                </div>
              </div>
              <div class="media-controls">
                <button type="button" class="media-controls__btn" aria-label="Previous track">
                  ◀
                </button>
                <button
                  type="button"
                  class="media-controls__btn media-controls__btn--primary"
                  aria-label="Pause"
                >
                  ❚❚
                </button>
                <button type="button" class="media-controls__btn" aria-label="Next track">
                  ▶
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  },
});
