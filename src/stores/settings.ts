import { ERR_INVALID_AUTH } from "home-assistant-js-websocket";
import { openHaConnection } from "@/services/haTransport";
import { defineStore } from "pinia";

export const HA_URL_KEY = "dedridge.ha.url";
export const HA_TOKEN_KEY = "dedridge.ha.token";

export type ValidationState = "idle" | "checking" | "valid" | "error";

interface SettingsState {
  url: string;
  token: string;
  validation: ValidationState;
  message: string;
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (trimmed === "") return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return "";
    return url.origin;
  } catch {
    return "";
  }
}

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    url: localStorage.getItem(HA_URL_KEY) ?? "",
    token: localStorage.getItem(HA_TOKEN_KEY) ?? "",
    validation: "idle",
    message: "",
  }),
  getters: {
    configured(state): boolean {
      return state.url !== "" && state.token !== "";
    },
  },
  actions: {
    async validateAndSave(url: string, token: string): Promise<boolean> {
      const normalized = normalizeUrl(url);
      const trimmedToken = token.trim();
      if (normalized === "" || trimmedToken === "") {
        this.validation = "error";
        this.message = "Enter a valid Home Assistant base URL and an access token.";
        return false;
      }

      this.validation = "checking";
      this.message = "Checking connection…";
      try {
        const connection = await openHaConnection(normalized, trimmedToken);
        connection.close();
      } catch (error) {
        this.validation = "error";
        this.message =
          error === ERR_INVALID_AUTH
            ? "Home Assistant rejected the token. Check it and try again."
            : "Could not reach Home Assistant. Check the URL and that this browser can open it.";
        return false;
      }

      this.url = normalized;
      this.token = trimmedToken;
      localStorage.setItem(HA_URL_KEY, this.url);
      localStorage.setItem(HA_TOKEN_KEY, this.token);
      this.validation = "valid";
      this.message = "Connected. Settings saved to this browser.";
      return true;
    },
    clear() {
      localStorage.removeItem(HA_URL_KEY);
      localStorage.removeItem(HA_TOKEN_KEY);
      this.url = "";
      this.token = "";
      this.validation = "idle";
      this.message = "";
    },
  },
});
