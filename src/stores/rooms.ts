import { defineStore } from "pinia";

import { demoRooms } from "@/data/demo/rooms";
import type {
  Light,
  LightColourSetting,
  MediaCommand,
  Room,
  Scene,
  RoomsState,
} from "@/models/rooms";
import { roomBindingFor } from "@/config/homeAssistant";
import { haCallService } from "@/services/haClient";

export type { MediaCommand, Room, Scene, RoomsState } from "@/models/rooms";

// UI light IDs remain independent of Home Assistant entity IDs.
function pushLight(roomId: string, lightId: string, level: number): void {
  const rooms = useRoomsStore();
  const light = rooms.rooms
    .find((room) => room.id === roomId)
    ?.lights.find((item) => item.id === lightId);
  const previous = light?.level ?? 0;
  if (light) light.level = level;
  const entityId = roomBindingFor(roomId)?.lights.find(
    (light) => light.lightId === lightId,
  )?.entityId;
  if (rooms.hasLiveData && entityId)
    void haCallService(
      entityId,
      level === 0 ? "turn_off" : "turn_on",
      level > 0 && light?.dimmable ? { brightness_pct: level } : undefined,
    ).then((result) => {
      if (rooms.hasLiveData && result !== "sent" && light?.level === level) light.level = previous;
    });
}

function colourServiceData(
  light: Light,
  setting: LightColourSetting,
): Record<string, number | readonly number[]> | undefined {
  const colour = light.colour;
  if (!colour) return;
  switch (setting.mode) {
    case "colour":
      if (colour.supportsColour) return { hs_color: setting.hs };
      return;
    case "temperature":
      if (colour.temperature) {
        const { min, max } = colour.temperature;
        return { color_temp_kelvin: Math.round(Math.min(max, Math.max(min, setting.kelvin))) };
      }
      return;
    case "white":
      if (colour.fixedWhite) return { white: Math.round((light.level || 100) * 2.55) };
      return;
  }
}

export const useRoomsStore = defineStore("rooms", {
  // Clone the module-level seeds so store instances never share mutable state.
  state: (): RoomsState =>
    structuredClone({
      rooms: demoRooms,
      selectedRoomId: "living-room",
      washingWeatherOk: false,
      outsideTempFromHa: null,
      houseTempFromHa: null,
      houseTargetFromHa: null,
      mode: "demo",
    }),
  getters: {
    hasLiveData: (state): boolean => state.mode === "live",
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
      if (state.mode === "live" || state.outsideTempFromHa !== null) return state.outsideTempFromHa;
      return state.rooms.find((room) => room.id === "garden")?.temp ?? 0;
    },
    houseTemp(state): number | null {
      if (state.mode === "live" || state.houseTempFromHa !== null) return state.houseTempFromHa;
      const inside = state.rooms.filter((r) => r.id !== "garden");
      const avg = inside.reduce((sum, r) => sum + (r.temp ?? 0), 0) / inside.length;
      return Math.round(avg * 2) / 2;
    },
    houseTarget(state): number | null {
      if (state.mode === "live" || state.houseTargetFromHa !== null) return state.houseTargetFromHa;
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
    async setLightColour(roomId: string, setting: LightColourSetting, lightId?: string) {
      const room = this.rooms.find((item) => item.id === roomId);
      const bindings = roomBindingFor(roomId)?.lights;
      if (!this.hasLiveData || !room || !bindings) return;

      const lights = lightId ? room.lights.filter((light) => light.id === lightId) : room.lights;
      await Promise.all(
        lights.map((light) => {
          const entityId = bindings.find((binding) => binding.lightId === light.id)?.entityId;
          const data = colourServiceData(light, setting);
          if (entityId && data) return haCallService(entityId, "turn_on", data);
        }),
      );
    },
    async adjustTarget(roomId: string, delta: number) {
      const room = this.rooms.find((r) => r.id === roomId);
      if (room && room.target !== null) {
        const previous = room.target;
        room.target = Math.round((room.target + delta) * 2) / 2;
        const climate = roomBindingFor(roomId)?.climate;
        if (this.hasLiveData && climate) {
          const target = room.target;
          const result = await haCallService(climate, "set_temperature", { temperature: target });
          if (result !== "sent" && room.target === target) room.target = previous;
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
      const entityId = roomBindingFor(roomId)?.media;
      if (!room?.media || !entityId) return;

      const previous = room.media.playing;
      if (command === "toggle") room.media.playing = !previous;
      if (!this.hasLiveData) return;
      const service = {
        previous: "media_previous_track",
        toggle: previous ? "media_pause" : "media_play",
        next: "media_next_track",
      } satisfies Record<MediaCommand, string>;
      const result = await haCallService(entityId, service[command]);
      if (command === "toggle" && result !== "sent" && room.media.playing !== previous) {
        room.media.playing = previous;
      }
    },
  },
});
