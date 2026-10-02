import { defineStore } from "pinia";

import { seedRooms } from "@/data/rooms";
import type { MediaCommand, Room, Scene } from "@/models/rooms";
import { roomBindingFor } from "@/services/homeyBindings/homeyRoomsBindings";
import { setHomeyCapability, setHomeyLight } from "@/services/homeyClient";

export type { MediaCommand, Room, Scene } from "@/models/rooms";

interface RoomsState {
  rooms: Room[];
  selectedRoomId: string;
  washingWeatherOk: boolean | null;
  outsideTempFromHomey: number | null;
  houseTempFromHomey: number | null;
  houseTargetFromHomey: number | null;
  dataFromHomey: boolean;
}

// Homey links are stable device IDs; UI light IDs stay page-owned.
function pushLight(roomId: string, lightId: string, level: number): void {
  const rooms = useRoomsStore();
  const light = rooms.rooms
    .find((room) => room.id === roomId)
    ?.lights.find((item) => item.id === lightId);
  const previous = light?.level ?? 0;
  if (light) light.level = level;
  const deviceId = roomBindingFor(roomId)?.lights.find(
    (light) => light.lightId === lightId,
  )?.deviceId;
  if (deviceId)
    void setHomeyLight(deviceId, level).then((result) => {
      if (rooms.dataFromHomey && result !== "sent" && light?.level === level)
        light.level = previous;
    });
}

export const useRoomsStore = defineStore("rooms", {
  // Clone the module-level seeds so store instances never share mutable state.
  state: (): RoomsState =>
    structuredClone({
      rooms: seedRooms,
      selectedRoomId: "living-room",
      washingWeatherOk: false,
      outsideTempFromHomey: null,
      houseTempFromHomey: null,
      houseTargetFromHomey: null,
      dataFromHomey: false,
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
      if (state.washingWeatherOk === null) return "DRYING WEATHER UNAVAILABLE";
      return state.washingWeatherOk ? "PUT OUT THE WASHING" : "DO NOT PUT OUT THE WASHING";
    },
    washingTone(state): "ok" | "alert" | "neutral" {
      if (state.washingWeatherOk === null) return "neutral";
      return state.washingWeatherOk ? "ok" : "alert";
    },
    outsideTemp(state): number | null {
      if (state.dataFromHomey || state.outsideTempFromHomey !== null)
        return state.outsideTempFromHomey;
      return state.rooms.find((room) => room.id === "garden")?.temp ?? 0;
    },
    houseTemp(state): number | null {
      if (state.dataFromHomey || state.houseTempFromHomey !== null) return state.houseTempFromHomey;
      const inside = state.rooms.filter((r) => r.id !== "garden");
      const avg = inside.reduce((sum, r) => sum + (r.temp ?? 0), 0) / inside.length;
      return Math.round(avg * 2) / 2;
    },
    houseTarget(state): number | null {
      if (state.dataFromHomey || state.houseTargetFromHomey !== null)
        return state.houseTargetFromHomey;
      const targets = state.rooms.filter((r) => r.id !== "garden").map((r) => r.target ?? 0);
      return Math.max(...targets);
    },
  },
  actions: {
    setHomeClimateValues(
      outsideTemperature: number | null,
      temperature: number | null,
      target: number | null,
    ) {
      this.outsideTempFromHomey = outsideTemperature;
      this.houseTempFromHomey = temperature;
      this.houseTargetFromHomey = target;
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
        pushLight(room.id, light.id, on ? 70 : 0);
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
        pushLight(roomId, lightId, Math.min(100, Math.max(0, level)));
      }
    },
    async adjustTarget(roomId: string, delta: number) {
      const room = this.rooms.find((r) => r.id === roomId);
      if (room && room.target !== null) {
        const previous = room.target;
        room.target = Math.round((room.target + delta) * 2) / 2;
        const climate = roomBindingFor(roomId)?.climate;
        if (climate) {
          const result = await setHomeyCapability(
            climate.deviceId,
            climate.capabilityId,
            room.target,
          );
          if (result !== "sent") room.target = previous;
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
        pushLight(room.id, light.id, levels[scene]);
      }
    },
    async controlMedia(roomId: string, command: MediaCommand) {
      const room = this.rooms.find((item) => item.id === roomId);
      const deviceId = roomBindingFor(roomId)?.media;
      if (!room?.media || !deviceId) return;

      const capability = {
        previous: "speaker_prev",
        toggle: "speaker_playing",
        next: "speaker_next",
      } satisfies Record<MediaCommand, string>;
      const previous = room.media.playing;
      if (command === "toggle") room.media.playing = !room.media.playing;
      const result = await setHomeyCapability(
        deviceId,
        capability[command],
        command === "toggle" ? room.media.playing : true,
      );
      if (this.dataFromHomey && result !== "sent") room.media.playing = previous;
    },
  },
});
