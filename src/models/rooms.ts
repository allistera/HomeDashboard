export interface Light {
  id: string;
  name: string;
  level: number;
  dimmable?: boolean;
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
  activityEntityIds?: string[];
  camera?: RoomCamera;
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

export interface DeviceProperty {
  id: string;
  name: string;
  value: string | number | boolean | null;
  units?: string;
}

export interface RoomDevice {
  id: string;
  name: string;
  type: string;
  available: boolean;
  properties?: DeviceProperty[];
}

export type Scene = "relax" | "bright" | "all-off";
export type MediaCommand = "previous" | "toggle" | "next";

export interface RoomCamera {
  id: string;
  name: string;
  available: boolean;
  snapshotUrl?: string;
}

export interface RoomsState {
  rooms: Room[];
  selectedRoomId: string;
  washingWeatherOk: boolean | null;
  outsideTempFromHa: number | null;
  houseTempFromHa: number | null;
  houseTargetFromHa: number | null;
  mode: "demo" | "live";
}
