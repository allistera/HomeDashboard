import { computed, defineComponent, ref } from "vue";

import TopBar from "@/components/TopBar";
import { useRoomsStore, type Room } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

type FloorId = "ground" | "first";
type ChipTone = "active" | "attention";

interface Chip {
  label: string;
  value: string;
  tone?: ChipTone;
}

interface Callout {
  roomId: string;
  left: number; // percent of canvas width
  top: number; // percent of canvas height
  line: string; // SVG path from callout to room dot
  dot: [number, number];
}

interface FloorPlan {
  id: FloorId;
  title: string;
  floorLabel: string;
  walls: string[];
  stairs: string;
  stairsAction: { text: string; target: FloorId };
  callouts: Callout[];
}

// Isometric grid: p(a, b) = (650 + (a - b) * 41.6, 150 + (a + b) * 24)
// on a 1300 x 800 canvas. Wall paths below are precomputed from that grid.
const OUTLINE = "M 650 150 L 1066 390 L 650 630 L 234 390 Z";
const SLAB = "M 1066 390 L 1066 408 L 650 648 L 234 408 L 234 390 M 650 630 L 650 648";

const floors: FloorPlan[] = [
  {
    id: "ground",
    title: "Ground floor",
    floorLabel: "Ground floor",
    walls: [
      "M 899.6 294 L 483.6 534", // a = 6
      "M 483.6 246 L 733.2 390", // b = 4, kitchen / hall
      "M 358.8 318 L 608.4 462", // b = 7, hall / utility
    ],
    stairs: "525.2,294 650,366 566.8,414 442,342",
    stairsAction: { text: "Go up to first floor", target: "first" },
    callouts: [
      {
        roomId: "kitchen",
        left: 3,
        top: 15,
        line: "M 355 132 H 691.6 V 258",
        dot: [691.6, 270],
      },
      {
        roomId: "hallway",
        left: 3,
        top: 45,
        line: "M 345 372 H 500 V 380",
        dot: [500, 388],
      },
      {
        roomId: "living-room",
        left: 71,
        top: 37,
        line: "M 920 320 H 774.8 V 450",
        dot: [774.8, 462],
      },
    ],
  },
  {
    id: "first",
    title: "First floor",
    floorLabel: "First floor",
    walls: [
      "M 858 270 L 442 510", // a = 5
      "M 442 270 L 858 510", // b = 5
    ],
    stairs: "442,318 546,378 462.8,426 358.8,366",
    stairsAction: { text: "Go down to ground floor", target: "ground" },
    callouts: [
      {
        roomId: "jaicobs-room",
        left: 3,
        top: 15,
        line: "M 355 132 H 650 V 258",
        dot: [650, 270],
      },
      {
        roomId: "bedroom",
        left: 71,
        top: 30,
        line: "M 920 252 H 858 V 378",
        dot: [858, 390],
      },
      {
        roomId: "elsies-room",
        left: 71,
        top: 62,
        line: "M 920 508 H 691.6 V 474",
        dot: [691.6, 462],
      },
    ],
  },
];

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

    const alert = computed(() => {
      const open = security.openEntries[0];
      if (open) return `${open.name} has been open 42 minutes`;
      return `Front door locked since ${security.secureSince}`;
    });

    const blindsChip = (room: Room): Chip | null => {
      if (room.blinds.length === 0) return null;
      const avg = Math.round(
        room.blinds.reduce((sum, b) => sum + b.closed, 0) / room.blinds.length,
      );
      const value = avg === 0 ? "Up" : avg === 100 ? "Down" : `${avg}%`;
      return { label: "Blinds", value };
    };

    const chipsFor = (room: Room): Chip[] => {
      const on = rooms.lightsOn(room);
      const chips: Chip[] = [
        {
          label: "Lights",
          value: on > 0 ? `${on} on` : "Off",
          tone: on > 0 ? "active" : undefined,
        },
      ];

      const blinds = blindsChip(room);
      switch (room.id) {
        case "kitchen":
          if (room.media?.playing) chips.push({ label: "Music", value: "On", tone: "active" });
          chips.push({ label: "Vacuum", value: "Clean" });
          break;
        case "living-room":
          if (blinds) chips.push(blinds);
          if (room.media?.playing) chips.push({ label: "TV", value: "On", tone: "active" });
          break;
        case "hallway": {
          chips.push({ label: "Motion", value: "6m ago" });
          const frontDoor = security.entries.find((e) => e.id === "front-door");
          if (frontDoor) {
            chips.push(
              frontDoor.locked
                ? { label: "Door", value: "Locked" }
                : { label: "Door", value: "Unlocked", tone: "attention" },
            );
          }
          break;
        }
        case "jaicobs-room": {
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
        case "bedroom":
        case "elsies-room":
          if (blinds) chips.push(blinds);
          chips.push({ label: "Heat", value: "Eco" });
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
          status={security.statusLabel}
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

        <div class="plan-wrap">
          <div class="plan-canvas">
            <svg viewBox="0 0 1300 800" aria-hidden="true">
              <defs>
                <pattern
                  id="stair-hatch"
                  patternUnits="userSpaceOnUse"
                  width="12"
                  height="12"
                  patternTransform="rotate(60)"
                >
                  <line x1="0" y1="0" x2="0" y2="12" class="plan__hatch-line" />
                </pattern>
              </defs>

              <path d={OUTLINE} class="plan__slab" />
              <path d={SLAB} class="plan__wall" fill="none" />
              <path d={OUTLINE} class="plan__wall" fill="none" />
              {floor.value.walls.map((d, index) => (
                <path key={index} d={d} class="plan__wall" fill="none" />
              ))}

              <polygon points={floor.value.stairs} class="plan__stairs" />
              <polygon points={floor.value.stairs} fill="url(#stair-hatch)" stroke="none" />

              {floor.value.callouts.map((callout) => (
                <g key={callout.roomId}>
                  <path d={callout.line} class="plan__lead" fill="none" />
                  <circle cx={callout.dot[0]} cy={callout.dot[1]} r="5" class="plan__dot" />
                </g>
              ))}
            </svg>

            {floor.value.callouts.map((callout) => {
              const room = roomById(callout.roomId);
              if (!room) return null;
              return (
                <div
                  key={callout.roomId}
                  class="callout"
                  style={{ left: `${callout.left}%`, top: `${callout.top}%` }}
                >
                  <div class="callout__head">
                    <span class="callout__name">{room.name}</span>
                    <span class="callout__temp">{room.temp.toFixed(1)}°</span>
                  </div>
                  <div class="callout__chips">
                    {chipsFor(room).map((chip) => (
                      <div
                        key={chip.label}
                        class={[
                          "chip",
                          {
                            "chip--active": chip.tone === "active",
                            "chip--attention": chip.tone === "attention",
                          },
                        ]}
                      >
                        <span class="chip__label">{chip.label}</span>
                        <span class="chip__value">{chip.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              class="stairs-btn"
              onClick={() => (floorId.value = floor.value.stairsAction.target)}
            >
              {floor.value.stairsAction.text}
              <span class="mono" style={{ fontSize: "11px", letterSpacing: "0.08em" }}>
                STAIRS
              </span>
            </button>
          </div>
        </div>

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
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span style={{ fontSize: "16px" }}>{alert.value}</span>
            <button type="button" class="btn btn--small">
              Remind me
            </button>
          </div>
        </div>
      </main>
    );
  },
});
