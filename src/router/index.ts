import { createRouter, createWebHistory } from "vue-router";

import FloorsPage from "@/pages/FloorsPage";
import HomePage from "@/pages/HomePage";
import RoomsPage from "@/pages/RoomsPage";
import SecurityPage from "@/pages/SecurityPage";
import SettingsPage from "@/pages/SettingsPage";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/rooms", name: "rooms", component: RoomsPage },
    { path: "/floors", name: "floors", component: FloorsPage },
    { path: "/energy", redirect: "/floors" },
    { path: "/security", name: "security", component: SecurityPage },
    { path: "/settings", name: "settings", component: SettingsPage },
  ],
});
