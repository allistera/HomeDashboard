import { createRouter, createWebHistory } from "vue-router";

import EnergyPage from "@/pages/EnergyPage";
import HomePage from "@/pages/HomePage";
import RoomsPage from "@/pages/RoomsPage";
import SecurityPage from "@/pages/SecurityPage";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/rooms", name: "rooms", component: RoomsPage },
    { path: "/energy", name: "energy", component: EnergyPage },
    { path: "/security", name: "security", component: SecurityPage },
  ],
});
