import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "@/App";
import { router } from "@/router";

import "@/styles/main.css";

createApp(App).use(createPinia()).use(router).mount("#app");
