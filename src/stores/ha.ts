import { defineStore } from "pinia";

export type HaStatus = "disconnected" | "connecting" | "connected" | "error";

interface HaState {
  status: HaStatus;
  message: string;
  entityCount: number;
}

export const useHaStore = defineStore("ha", {
  state: (): HaState => ({
    status: "disconnected",
    message: "",
    entityCount: 0,
  }),
});
