import { defineStore } from "pinia";

import { roomBindingFor } from "@/services/haBindings";
import { haCallService } from "@/services/haClient";

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
  motion?: { active: boolean; lastChanged: string };
  vacuum?: { state: string };
  climateMode?: string;
  events: RoomEvent[];
  deviceCount: number;
  offlineCount: number;
}

export type Scene = "relax" | "bright" | "all-off";
export type MediaCommand = "previous" | "toggle" | "next";

interface RoomsState {
  rooms: Room[];
  selectedRoomId: string;
  activity: RoomEvent[];
  outsideTempFromHa: number | null;
  houseTempFromHa: number | null;
  houseTargetFromHa: number | null;
}

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
    vacuum: { state: "Ready" },
    events: [{ time: "6:58", text: "Vacuum returned to dock" }],
    deviceCount: 5,
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
    motion: { active: false, lastChanged: "6m ago" },
    events: [],
    deviceCount: 2,
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
    climateMode: "Eco",
    events: [{ time: "6:30", text: "Blinds lowered · sunset" }],
    deviceCount: 4,
    offlineCount: 0,
  },
  {
    id: "jaicobs-room",
    name: "Jaicobs Room",
    floor: "First floor",
    lights: [
      { id: "ceiling", name: "Ceiling", level: 0 },
      { id: "desk", name: "Desk lamp", level: 0 },
    ],
    blinds: [{ id: "window", name: "Window", closed: 0 }],
    temp: 20.0,
    target: 20.0,
    meta: "WINDOW OPEN",
    events: [],
    deviceCount: 4,
    offlineCount: 0,
  },
  {
    id: "elsies-room",
    name: "Elsies Room",
    floor: "First floor",
    lights: [
      { id: "ceiling", name: "Ceiling", level: 0 },
      { id: "night-light", name: "Night light", level: 20 },
    ],
    blinds: [{ id: "window", name: "Window", closed: 100 }],
    temp: 20.0,
    target: 20.0,
    meta: "NIGHT LIGHT",
    climateMode: "Eco",
    events: [{ time: "7:30", text: "Night light on · bedtime" }],
    deviceCount: 4,
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
  { time: "7:02", text: "Front door unlocked by Allister" },
  { time: "6:58", text: "Vacuum returned to dock" },
  { time: "6:30", text: "Blinds lowered · sunset" },
  { time: "5:47", text: "Package detected at front door" },
];

// Mirrors a dashboard light change out to Home Assistant (no-op offline).
function pushLight(roomId: string, lightId: string, level: number): void {
  const entityId = roomBindingFor(roomId)?.lights.find((l) => l.lightId === lightId)?.entityId;
  if (!entityId) return;
  if (level > 0) {
    void haCallService("light", "turn_on", { brightness_pct: level }, { entity_id: entityId });
  } else {
    void haCallService("light", "turn_off", undefined, { entity_id: entityId });
  }
}

export const useRoomsStore = defineStore("rooms", {
  state: (): RoomsState => ({
    rooms: seedRooms,
    selectedRoomId: "living-room",
    activity: seedActivity,
    outsideTempFromHa: null,
    houseTempFromHa: null,
    houseTargetFromHa: null,
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
    outsideTemp(state): number {
      if (state.outsideTempFromHa !== null) return state.outsideTempFromHa;
      return state.rooms.find((room) => room.id === "garden")?.temp ?? 0;
    },
    houseTemp(state): number {
      if (state.houseTempFromHa !== null) return state.houseTempFromHa;
      const inside = state.rooms.filter((r) => r.id !== "garden");
      const avg = inside.reduce((sum, r) => sum + r.temp, 0) / inside.length;
      return Math.round(avg * 2) / 2;
    },
    houseTarget(state): number {
      if (state.houseTargetFromHa !== null) return state.houseTargetFromHa;
      const targets = state.rooms.filter((r) => r.id !== "garden").map((r) => r.target);
      return Math.max(...targets);
    },
  },
  actions: {
    setHomeClimateValues(
      outsideTemperature: number | null,
      temperature: number | null,
      target: number | null,
    ) {
      this.outsideTempFromHa = outsideTemperature;
      this.houseTempFromHa = temperature;
      this.houseTargetFromHa = target;
    },
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
        pushLight(room.id, light.id, light.level);
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
        pushLight(roomId, lightId, light.level);
      }
    },
    adjustTarget(roomId: string, delta: number) {
      const room = this.rooms.find((r) => r.id === roomId);
      if (room) {
        room.target = Math.round((room.target + delta) * 2) / 2;
        const climate = roomBindingFor(roomId)?.climate;
        if (climate) {
          void haCallService(
            "climate",
            "set_temperature",
            { temperature: room.target },
            { entity_id: climate },
          );
        }
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
        pushLight(room.id, light.id, light.level);
      }
    },
    controlMedia(roomId: string, command: MediaCommand) {
      const room = this.rooms.find((item) => item.id === roomId);
      const entityId = roomBindingFor(roomId)?.media;
      if (!room?.media || !entityId) return;

      const service = {
        previous: "media_previous_track",
        toggle: "media_play_pause",
        next: "media_next_track",
      } satisfies Record<MediaCommand, string>;
      void haCallService("media_player", service[command], undefined, { entity_id: entityId });
      if (command === "toggle") room.media.playing = !room.media.playing;
    },
  },
});
