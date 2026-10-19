import { computed, defineComponent, ref } from "vue";

import TopBar from "@/components/TopBar";
import { floorsPageBindings } from "@/services/homeyBindings/homeyFloorsBindings";
import FloorPlanCanvas, { type Chip } from "@/components/FloorPlanCanvas";
import { floors, type FloorId } from "@/data/floors";
import "./FloorsPage.css";
import { useRoomsStore, type Room } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

export default defineComponent({
  name: "FloorsPage",
  setup() {
    const rooms = useRoomsStore();
    const security = useSecurityStore();
    const floorId = ref<FloorId>("ground");

    const floor = computed(() => floors.find((f) => f.id === floorId.value) ?? floors[0]);

    const floorRooms = computed(() =>
      rooms.rooms.filter((r) => r.floor === floor.value.floorLabel),
    );

    const floorSummary = computed(() => {
      const list = floorRooms.value;
      const lights = list.reduce((sum, r) => sum + r.lights.length, 0);
      const on = list.reduce((sum, r) => sum + rooms.lightsOn(r), 0);
      return `${list.length} ROOMS · ${lights} LIGHTS · ${on} ON`;
    });

    const deviceCount = computed(() => rooms.rooms.reduce((sum, r) => sum + r.deviceCount, 0));

    const chipsFor = (room: Room): Chip[] => {
      const on = rooms.lightsOn(room);
      const chips: Chip[] = [];
      if (room.lights.length > 0) {
        chips.push({
          label: "Lights",
          value: on > 0 ? `${on} on` : "Off",
          tone: on > 0 ? "active" : undefined,
          onClick: () => rooms.setRoomLights(room.id, on === 0),
        });
      }

      switch (room.id) {
        case floorsPageBindings.kitchenRoomId:
          if (room.media?.playing) chips.push({ label: "Music", value: "On", tone: "active" });
          if (room.vacuum) {
            chips.push({
              label: "Vacuum",
              value: room.vacuum.state,
              tone: room.vacuum.state === "Cleaning" ? "active" : undefined,
            });
          }
          break;
        case floorsPageBindings.livingRoomId:
          if (room.media?.playing) chips.push({ label: "TV", value: "On", tone: "active" });
          break;
        case floorsPageBindings.hallwayRoomId: {
          if (room.motion) {
            chips.push({
              label: "Motion",
              value: room.motion.active ? "Active" : room.motion.lastChanged,
              tone: room.motion.active ? "attention" : undefined,
            });
          }
          const frontDoor = security.entries.find((e) => e.id === "front-door");
          if (frontDoor) {
            chips.push(
              frontDoor.locked
                ? {
                    label: "Door",
                    value: "Locked",
                    onClick: () => security.setLocked(frontDoor.id, false),
                  }
                : {
                    label: "Door",
                    value: "Unlocked",
                    tone: "attention",
                    onClick: () => security.setLocked(frontDoor.id, true),
                  },
            );
          }
          break;
        }
        case floorsPageBindings.jaicobsRoomId: {
          const window = security.entries.find((e) => e.id === "jaicobs-room-window");
          if (window) {
            chips.push(
              window.open
                ? { label: "Window", value: "Open", tone: "attention" }
                : { label: "Window", value: "Closed" },
            );
          }
          break;
        }
        case floorsPageBindings.bedroomRoomIds[0]:
        case floorsPageBindings.bedroomRoomIds[1]:
          if (room.climateMode) chips.push({ label: "Heat", value: room.climateMode });
          break;
      }
      return chips;
    };

    const roomById = (id: string) => rooms.rooms.find((r) => r.id === id);

    return () => (
      <main class="main">
        <TopBar
          left={[`2 STOREYS · ${deviceCount.value} DEVICES`]}
          showPeople
          status={rooms.washingLabel}
          statusTone={rooms.washingTone}
        />

        <div class="hero" style={{ padding: "36px 40px 26px" }}>
          <div>
            <div class="label">Floor plan</div>
            <h1 class="hero__title">{floor.value.title}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <span class="label" style={{ letterSpacing: "0.06em" }}>
              {floorSummary.value}
            </span>
            <div class="hero__actions">
              {floors.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  class={["btn", "btn--small", { "btn--primary": floorId.value === f.id }]}
                  onClick={() => (floorId.value = f.id)}
                >
                  {f.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <FloorPlanCanvas floor={floor.value} roomById={roomById} chipsFor={chipsFor} />

        <div class="plan-foot">
          <div class="legend">
            <span>
              <span class="legend__swatch" style={{ background: "var(--accent)" }} /> ACTIVE
            </span>
            <span>
              <span class="legend__swatch" style={{ background: "var(--ink)" }} /> NEEDS ATTENTION
            </span>
            <span>
              <span class="legend__swatch" style={{ border: "1px solid var(--btn-border)" }} /> IDLE
            </span>
          </div>
        </div>
      </main>
    );
  },
});
