import { defineStore } from "pinia";

import { seedRooms } from "@/data/rooms";
import type { MediaCommand, Room, Scene } from "@/models/rooms";
import { roomBindingFor } from "@/services/haBindings";
import { haCallService } from "@/services/haClient";

export type { MediaCommand, Room, Scene } from "@/models/rooms";

interface RoomsState {
  rooms: Room[];
  selectedRoomId: string;
  washingWeatherOk: boolean;
  outsideTempFromHa: number | null;
  houseTempFromHa: number | null;
  houseTargetFromHa: number | null;
}

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
  // Clone the module-level seeds so store instances never share mutable state.
  state: (): RoomsState =>
    structuredClone({
      rooms: seedRooms,
      selectedRoomId: "living-room",
      washingWeatherOk: false,
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
    washingLabel(state): string {
      return state.washingWeatherOk ? "PUT OUT THE WASHING" : "DO NOT PUT OUT THE WASHING";
    },
    washingTone(state): "ok" | "alert" {
      return state.washingWeatherOk ? "ok" : "alert";
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
    setWashingWeather(ok: boolean) {
      this.washingWeatherOk = ok;
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
    setLightPower(roomId: string, lightId: string, on: boolean) {
      const light = this.rooms
        .find((room) => room.id === roomId)
        ?.lights.find((item) => item.id === lightId);
      if (!light) return;
      this.setLightLevel(roomId, lightId, on ? Math.max(light.level, 70) : 0);
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
