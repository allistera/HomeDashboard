import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: () => import("@/pages/HomePage") },
    { path: "/rooms", name: "rooms", component: () => import("@/pages/RoomsPage") },
    { path: "/floors", name: "floors", component: () => import("@/pages/FloorsPage") },
    { path: "/energy", redirect: "/floors" },
    { path: "/security", name: "security", component: () => import("@/pages/SecurityPage") },
    { path: "/settings", name: "settings", component: () => import("@/pages/SettingsPage") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
