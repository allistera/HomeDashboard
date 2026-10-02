import { defineStore } from "pinia";

export const HOMEY_URL_KEY = "dedridge.homey.url";
export const HOMEY_TOKEN_KEY = "dedridge.homey.token";

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
  // Default to https so a long-lived token is never sent in plaintext by
  // accident; an explicit http:// prefix is still honored for LAN setups.
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    url: localStorage.getItem(HOMEY_URL_KEY) ?? "",
    token: localStorage.getItem(HOMEY_TOKEN_KEY) ?? "",
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
        this.message = "Enter both a URL and an access token.";
        return false;
      }

      this.validation = "checking";
      this.message = "Checking connection…";
      try {
        const response = await fetch(`${normalized}/api/manager/devices/device`, {
          headers: { Authorization: `Bearer ${trimmedToken}` },
        });
        if (response.status === 401 || response.status === 403) {
          this.validation = "error";
          this.message =
            "Homey rejected the token or its device permissions. Check it and try again.";
          return false;
        }
        if (!response.ok) {
          this.validation = "error";
          this.message = `Unexpected response from Homey (HTTP ${response.status}).`;
          return false;
        }
      } catch {
        this.validation = "error";
        this.message =
          "Could not reach Homey. Check the address and browser access. " +
          "An HTTPS dashboard needs an HTTPS Homey address.";
        return false;
      }

      this.url = normalized;
      this.token = trimmedToken;
      localStorage.setItem(HOMEY_URL_KEY, this.url);
      localStorage.setItem(HOMEY_TOKEN_KEY, this.token);
      this.validation = "valid";
      this.message = "Token validated. Settings saved to this browser.";
      return true;
    },
    clear() {
      localStorage.removeItem(HOMEY_URL_KEY);
      localStorage.removeItem(HOMEY_TOKEN_KEY);
      this.url = "";
      this.token = "";
      this.validation = "idle";
      this.message = "";
    },
  },
});
