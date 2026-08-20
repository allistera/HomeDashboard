import { computed, defineComponent, ref } from "vue";

import TopBar from "@/components/TopBar";
import { floorsPageBindings } from "@/services/haBindings";
import { useRoomsStore, type Room } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

type FloorId = "ground" | "first";
type ChipTone = "active" | "attention";

interface Chip {
  label: string;
  value: string;
  tone?: ChipTone;
  onClick?: () => void;
}

interface Callout {
  roomId: string;
  left: number; // percent of canvas width
  top: number; // percent of canvas height
  line: string; // SVG path from callout to room dot
  dot: [number, number];
}

interface PlanLabel {
  x: number;
  y: number;
  text: string;
}

interface PlanMarker {
  label: string;
  left: number; // percent of canvas width
  top: number; // percent of canvas height
  line: string; // SVG path from marker to dot
  dot: [number, number];
}

interface FloorPlan {
  id: FloorId;
  title: string;
  floorLabel: string;
  outline: string;
  slab: string;
  walls: string[];
  stairs: string;
  labels: PlanLabel[];
  callouts: Callout[];
  markers?: PlanMarker[];
}

// Isometric grid: p(a, b) = (660 + (a - b) * 38, 140 + (a + b) * 22) on a
// 1300 x 800 canvas. Geometry traced from the real Dedridge floor plan:
// ground floor is an L-shape (kitchen block raised top-left, lounge/dining
// down the right, stairs + closets + WC on the left), first floor is a
// rectangle with three bedrooms, a bathroom, and a closet under the stairs.
const floors: FloorPlan[] = [
  {
    id: "ground",
    title: "Ground floor",
    floorLabel: "Ground floor",
    outline: "M 660 140 L 850 250 L 812 272 L 1002 382 L 584 624 L 204 404 Z",
    slab: "M 1002 382 L 1002 398 L 584 640 L 204 420 L 204 404 M 584 624 L 584 640",
    walls: [
      "M 812 272 L 394 514", // hall / lounge divider (x = 5)
      "M 432 272 L 622 382", // kitchen back wall (y = 6)
      "M 299 349 L 394 404", // closet wall (y = 9.5)
      "M 261 371 L 356 426", // closet divider (y = 10.5)
      "M 394 404 L 299 459", // closet / hall divider (x = 2.5)
      "M 470 294 L 413 327", // hall closet wall (x = 1)
      "M 375 305 L 413 327", // hall closet wall (y = 7.5)
    ],
    stairs: "451,305 527,349 432,404 356,360",
    labels: [
      { x: 422, y: 303, text: "C" },
      { x: 326, y: 390, text: "C" },
      { x: 280, y: 417, text: "C" },
    ],
    callouts: [
      {
        roomId: "kitchen",
        left: 3,
        top: 15,
        line: "M 355 132 H 641 V 249",
        dot: [641, 261],
      },
      {
        roomId: "hallway",
        left: 3,
        top: 45,
        line: "M 345 372 H 500 V 388",
        dot: [500, 400],
      },
      {
        roomId: "living-room",
        left: 71,
        top: 37,
        line: "M 920 320 H 698 V 436",
        dot: [698, 448],
      },
    ],
    markers: [
      {
        label: "Garden",
        left: 34,
        top: 2,
        line: "M 750 60 H 793 V 161",
        dot: [793, 173],
      },
    ],
  },
  {
    id: "first",
    title: "First floor",
    floorLabel: "First floor",
    outline: "M 660 140 L 1040 360 L 622 602 L 242 382 Z",
    slab: "M 1040 360 L 1040 376 L 622 618 L 242 398 L 242 382 M 622 602 L 622 618",
    walls: [
      "M 839 243 L 421 485", // bedrooms / landing divider (x = 4.7)
      "M 489 239 L 668 342", // Jaicobs Room back wall (y = 4.5)
      "M 618 371 L 820 488", // bedroom / Elsies Room divider (y = 5.8)
      "M 329 331 L 508 435", // bathroom wall (y = 8.7)
    ],
    stairs: "497,257 565,296 462,356 394,316",
    labels: [
      { x: 398, y: 349, text: "C" },
      { x: 375, y: 410, text: "BATHROOM" },
    ],
    callouts: [
      {
        roomId: "elsies-room",
        left: 3,
        top: 15,
        line: "M 355 132 H 664 V 227",
        dot: [664, 239],
      },
      {
        roomId: "bedroom",
        left: 71,
        top: 30,
        line: "M 920 252 H 835 V 352",
        dot: [835, 364],
      },
      {
        roomId: "jaicobs-room",
        left: 71,
        top: 62,
        line: "M 920 508 H 622 V 496",
        dot: [622, 488],
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
          onClick: () => rooms.setRoomLights(room.id, on === 0),
        },
      ];

      const blinds = blindsChip(room);
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
          if (blinds) chips.push(blinds);
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
        case floorsPageBindings.bedroomRoomIds[0]:
        case floorsPageBindings.bedroomRoomIds[1]:
          if (blinds) chips.push(blinds);
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
          status={security.statusLabel}
          statusTone={security.statusTone}
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

              <path d={floor.value.outline} class="plan__slab" />
              <path d={floor.value.slab} class="plan__wall" fill="none" />
              <path d={floor.value.outline} class="plan__wall" fill="none" />
              {floor.value.walls.map((d, index) => (
                <path key={index} d={d} class="plan__wall" fill="none" />
              ))}

              <polygon points={floor.value.stairs} class="plan__stairs" />
              <polygon points={floor.value.stairs} fill="url(#stair-hatch)" stroke="none" />

              {floor.value.labels.map((label) => (
                <text key={label.text} x={label.x} y={label.y} class="plan__label">
                  {label.text}
                </text>
              ))}

              {floor.value.callouts.map((callout) => (
                <g key={callout.roomId}>
                  <path d={callout.line} class="plan__lead" fill="none" />
                  <circle cx={callout.dot[0]} cy={callout.dot[1]} r="5" class="plan__dot" />
                </g>
              ))}

              {(floor.value.markers ?? []).map((marker) => (
                <g key={marker.label}>
                  <path d={marker.line} class="plan__lead" fill="none" />
                  <circle cx={marker.dot[0]} cy={marker.dot[1]} r="5" class="plan__dot" />
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
                    {chipsFor(room).map((chip) => {
                      const chipClass = [
                        "chip",
                        {
                          "chip--active": chip.tone === "active",
                          "chip--attention": chip.tone === "attention",
                          "chip--button": Boolean(chip.onClick),
                        },
                      ];
                      return chip.onClick ? (
                        <button
                          type="button"
                          key={chip.label}
                          class={chipClass}
                          onClick={chip.onClick}
                        >
                          <span class="chip__label">{chip.label}</span>
                          <span class="chip__value">{chip.value}</span>
                        </button>
                      ) : (
                        <div key={chip.label} class={chipClass}>
                          <span class="chip__label">{chip.label}</span>
                          <span class="chip__value">{chip.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {(floor.value.markers ?? []).map((marker) => (
              <div
                key={marker.label}
                class="callout"
                style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
              >
                <div class="callout__head">
                  <span class="callout__name">{marker.label}</span>
                </div>
              </div>
            ))}
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
        </div>
      </main>
    );
  },
});
