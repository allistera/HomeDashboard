import { defineStore } from "pinia";

export interface Light {
  id: string;
  name: string;
  level: number;
}

export interface Blind {
  id: string;
  name: string;
  closed: number;
}

export interface RoomEvent {
  time: string;
  text: string;
}

export interface Room {
  id: string;
  name: string;
  floor: string;
  lights: Light[];
  blinds: Blind[];
  temp: number;
  target: number;
  meta: string;
  media?: { title: string; output: string; playing: boolean };
  events: RoomEvent[];
  deviceCount: number;
  offlineCount: number;
}

export type Scene = "relax" | "bright" | "all-off";

const seedRooms: Room[] = [
  {
    id: "living-room",
    name: "Living room",
    floor: "Ground floor",
    lights: [
      { id: "ceiling", name: "Ceiling", level: 72 },
      { id: "floor-lamp", name: "Floor lamp", level: 40 },
      { id: "shelf-strip", name: "Shelf strip", level: 15 },
      { id: "reading-lamp", name: "Reading lamp", level: 0 },
    ],
    blinds: [
      { id: "south-window", name: "South window", closed: 75 },
      { id: "patio-door", name: "Patio door", closed: 100 },
    ],
    temp: 21.5,
    target: 21.5,
    meta: "TV ON",
    media: {
      title: "Evening Acoustic",
      output: "Soundbar · grouped with kitchen",
      playing: true,
    },
    events: [
      { time: "7:10", text: "Relax scene started" },
      { time: "6:30", text: "Blinds lowered · sunset" },
      { time: "2:15", text: "Vacuum cleaned living room" },
    ],
    deviceCount: 6,
    offlineCount: 1,
  },
  {
    id: "kitchen",
    name: "Kitchen",
    floor: "Ground floor",
    lights: [
      { id: "ceiling", name: "Ceiling", level: 85 },
      { id: "counter-strip", name: "Counter strip", level: 60 },
    ],
    blinds: [],
    temp: 21.0,
    target: 21.0,
    meta: "MUSIC",
    media: {
      title: "Evening Acoustic",
      output: "Kitchen speaker",
      playing: true,
    },
    events: [{ time: "6:58", text: "Vacuum returned to dock" }],
    deviceCount: 5,
    offlineCount: 0,
  },
  {
    id: "bedroom",
    name: "Bedroom",
    floor: "First floor",
    lights: [
      { id: "ceiling", name: "Ceiling", level: 0 },
      { id: "bedside", name: "Bedside lamp", level: 0 },
    ],
    blinds: [{ id: "window", name: "Window", closed: 100 }],
    temp: 19.5,
    target: 19.5,
    meta: "BLINDS DOWN",
    events: [{ time: "6:30", text: "Blinds lowered · sunset" }],
    deviceCount: 4,
    offlineCount: 0,
  },
  {
    id: "studio",
    name: "Studio",
    floor: "First floor",
    lights: [{ id: "desk", name: "Desk lamp", level: 0 }],
    blinds: [],
    temp: 20.0,
    target: 20.0,
    meta: "",
    events: [],
    deviceCount: 3,
    offlineCount: 0,
  },
  {
    id: "hallway",
    name: "Hallway",
    floor: "Ground floor",
    lights: [{ id: "ceiling", name: "Ceiling", level: 55 }],
    blinds: [],
    temp: 20.5,
    target: 20.5,
    meta: "MOTION 6M AGO",
    events: [],
    deviceCount: 2,
    offlineCount: 0,
  },
  {
    id: "garden",
    name: "Garden",
    floor: "Outside",
    lights: [{ id: "path", name: "Path lights", level: 0 }],
    blinds: [],
    temp: 12.0,
    target: 12.0,
    meta: "CAMERA ON",
    events: [],
    deviceCount: 2,
    offlineCount: 0,
  },
];

const seedActivity: RoomEvent[] = [
  { time: "7:02", text: "Front door unlocked by Mara" },
  { time: "6:58", text: "Vacuum returned to dock" },
  { time: "6:30", text: "Blinds lowered · sunset" },
  { time: "5:47", text: "Package detected at front door" },
];

export const useRoomsStore = defineStore("rooms", {
  state: () => ({
    rooms: seedRooms,
    selectedRoomId: "living-room",
    activity: seedActivity,
  }),
  getters: {
    selectedRoom(state): Room {
      return state.rooms.find((r) => r.id === state.selectedRoomId) ?? state.rooms[0];
    },
    lightsOn(): (room: Room) => number {
      return (room) => room.lights.filter((l) => l.level > 0).length;
    },
    anyLightOn(state): boolean {
      return state.rooms.some((r) => r.lights.some((l) => l.level > 0));
    },
    houseTemp(state): number {
      const inside = state.rooms.filter((r) => r.id !== "garden");
      const avg = inside.reduce((sum, r) => sum + r.temp, 0) / inside.length;
      return Math.round(avg * 2) / 2;
    },
    houseTarget(state): number {
      const targets = state.rooms.filter((r) => r.id !== "garden").map((r) => r.target);
      return Math.max(...targets);
    },
  },
  actions: {
    selectRoom(id: string) {
      if (this.rooms.some((r) => r.id === id)) {
        this.selectedRoomId = id;
      }
    },
    setRoomLights(id: string, on: boolean) {
      const room = this.rooms.find((r) => r.id === id);
      if (!room) return;
      for (const light of room.lights) {
        light.level = on ? 70 : 0;
      }
    },
    setAllLights(on: boolean) {
      for (const room of this.rooms) {
        this.setRoomLights(room.id, on);
      }
    },
    setLightLevel(roomId: string, lightId: string, level: number) {
      const light = this.rooms.find((r) => r.id === roomId)?.lights.find((l) => l.id === lightId);
      if (light) {
        light.level = Math.min(100, Math.max(0, level));
      }
    },
    adjustTarget(roomId: string, delta: number) {
      const room = this.rooms.find((r) => r.id === roomId);
      if (room) {
        room.target = Math.round((room.target + delta) * 2) / 2;
      }
    },
    applyScene(roomId: string, scene: Scene) {
      const room = this.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const levels = {
        relax: 35,
        bright: 100,
        "all-off": 0,
      } satisfies Record<Scene, number>;
      for (const light of room.lights) {
        light.level = levels[scene];
      }
    },
  },
});
