import { defineStore } from "pinia";

export type HomeyStatus = "disconnected" | "connecting" | "connected" | "error";

interface HomeyState {
  status: HomeyStatus;
  message: string;
  deviceCount: number;
}

export const useHomeyStore = defineStore("homey", {
  state: (): HomeyState => ({
    status: "disconnected",
    message: "",
    deviceCount: 0,
  }),
});
