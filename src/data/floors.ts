export type FloorId = "ground" | "first";
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

export interface FloorPlan {
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
export const floors: FloorPlan[] = [
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
