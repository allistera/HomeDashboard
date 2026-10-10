export interface Light {
  id: string;
  name: string;
  level: number;
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
  devices?: RoomDevice[];
  temp: number | null;
  target: number | null;
  meta: string;
  media?: { title: string; output: string; playing: boolean; active: boolean };
  motion?: { active: boolean; lastChanged: string; lastChangedAt?: number };
  vacuum?: { state: string };
  climateMode?: string;
  events: RoomEvent[];
  deviceCount: number;
  offlineCount: number;
}

export interface RoomDevice {
  id: string;
  name: string;
  type: string;
  available: boolean;
}

export type Scene = "relax" | "bright" | "all-off";
export type MediaCommand = "previous" | "toggle" | "next";
