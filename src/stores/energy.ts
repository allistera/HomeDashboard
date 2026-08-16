import { defineStore } from "pinia";

export type EnergyRange = "day" | "week" | "month" | "year";

export interface RangeSummary {
  usage: string;
  cost: string;
  note: string;
}

const summaries: Record<EnergyRange, RangeSummary> = {
  day: {
    usage: "14.2 kWh",
    cost: "£3.98",
    note: "About 9% below your usual Thursday. Heating is the biggest share; the dryer accounted for a third of this afternoon's spike.",
  },
  week: {
    usage: "84.6 kWh",
    cost: "£23.70",
    note: "Tracking 5% under last week. Thursday was the heaviest day, driven by the dryer and an extra heating hour.",
  },
  month: {
    usage: "338 kWh",
    cost: "£94.60",
    note: "Twelve days in and trending £9 under last month. Heating remains two-thirds of the total.",
  },
  year: {
    usage: "3,912 kWh",
    cost: "£1,095",
    note: "On pace for your lowest year yet — the heat pump swap in March is doing most of the work.",
  },
};

export const useEnergyStore = defineStore("energy", {
  state: () => ({
    range: "day" as EnergyRange,
    liveDrawKw: 1.4,
    tariff: "0.28 / KWH",
    billingDay: 12,
    billingDays: 30,
    hourly: [
      14, 11, 10, 9, 12, 22, 38, 46, 31, 24, 20, 26, 35, 58, 72, 49, 44, 62, 100, 86, 74, 57, 40,
      33,
    ],
    peakNote: "PEAK 3.6 AT 18:00",
    liveHoursFromEnd: 6,
    usingNow: [
      { name: "Heating", kw: 0.82 },
      { name: "Hot water", kw: 0.26 },
      { name: "Kitchen appliances", kw: 0.18 },
      { name: "Lights & media", kw: 0.14 },
    ],
    byRoom: [
      { name: "Kitchen", kwh: 4.9 },
      { name: "Living room", kwh: 3.1 },
      { name: "Utility", kwh: 2.6 },
      { name: "Bedroom", kwh: 1.8 },
      { name: "Studio", kwh: 1.8 },
    ],
    week: [
      { day: "M", height: 62, state: "past" },
      { day: "T", height: 48, state: "past" },
      { day: "W", height: 55, state: "past" },
      { day: "T", height: 70, state: "past" },
      { day: "F", height: 44, state: "today" },
      { day: "S", height: 20, state: "future" },
      { day: "S", height: 20, state: "future" },
    ],
    projectedBill: "£118",
    projectedNote: "£9 under last month",
  }),
  getters: {
    summary(state): RangeSummary {
      return summaries[state.range];
    },
    maxDrawKw(state): number {
      return Math.max(...state.usingNow.map((u) => u.kw));
    },
  },
  actions: {
    setRange(range: EnergyRange) {
      this.range = range;
    },
  },
});
