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
