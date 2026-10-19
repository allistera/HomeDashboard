import { HomeyTransport } from "@/services/homeyTransport";
import { defineStore } from "pinia";

export type HomeyStatus = "disconnected" | "connecting" | "connected" | "error";

interface HomeyState {
  transport: HomeyTransport;
  deviceCount: number;
}

export const useHomeyStore = defineStore("homey", {
  state: (): HomeyState => ({
    transport: new HomeyTransport(),
    deviceCount: 0,
  }),
  getters: {
    status: (state): HomeyStatus => state.transport.status,
    message: (state): string => state.transport.message,
  },
});
