import { defineStore } from "pinia";
import type { HomeyZone } from "@/services/homeyTypes";

interface ZonesState {
  zones: Record<string, HomeyZone>;
  unavailable: boolean;
}

export const useZonesStore = defineStore("zones", {
  state: (): ZonesState => ({
    zones: {},
    unavailable: false,
  }),
});
