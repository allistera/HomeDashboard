import { defineStore } from "pinia";

export const HA_URL_KEY = "dedridge.ha.url";
export const HA_TOKEN_KEY = "dedridge.ha.token";
export const HA_HOUSE_TEMP_ENTITY_KEY = "dedridge.ha.houseTemp.entity";
export const HA_HOUSE_TEMP_ATTRIBUTE_KEY = "dedridge.ha.houseTemp.attribute";
export const HA_HOUSE_TARGET_ENTITY_KEY = "dedridge.ha.houseTarget.entity";
export const HA_HOUSE_TARGET_ATTRIBUTE_KEY = "dedridge.ha.houseTarget.attribute";

export type ValidationState = "idle" | "checking" | "valid" | "error";

interface SettingsState {
  url: string;
  token: string;
  houseTempEntity: string;
  houseTempAttribute: string;
  houseTargetEntity: string;
  houseTargetAttribute: string;
  validation: ValidationState;
  message: string;
}

export interface HouseClimateSources {
  houseTempEntity: string;
  houseTempAttribute: string;
  houseTargetEntity: string;
  houseTargetAttribute: string;
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (trimmed === "") return "";
  return /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    url: localStorage.getItem(HA_URL_KEY) ?? "",
    token: localStorage.getItem(HA_TOKEN_KEY) ?? "",
    houseTempEntity: localStorage.getItem(HA_HOUSE_TEMP_ENTITY_KEY) ?? "",
    houseTempAttribute: localStorage.getItem(HA_HOUSE_TEMP_ATTRIBUTE_KEY) ?? "",
    houseTargetEntity: localStorage.getItem(HA_HOUSE_TARGET_ENTITY_KEY) ?? "",
    houseTargetAttribute: localStorage.getItem(HA_HOUSE_TARGET_ATTRIBUTE_KEY) ?? "",
    validation: "idle",
    message: "",
  }),
  getters: {
    configured(state): boolean {
      return state.url !== "" && state.token !== "";
    },
  },
  actions: {
    async validateAndSave(
      url: string,
      token: string,
      sources?: HouseClimateSources,
    ): Promise<boolean> {
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
        const response = await fetch(`${normalized}/api/`, {
          headers: { Authorization: `Bearer ${trimmedToken}` },
        });
        if (response.status === 401 || response.status === 403) {
          this.validation = "error";
          this.message = "Home Assistant rejected the token. Check it and try again.";
          return false;
        }
        if (!response.ok) {
          this.validation = "error";
          this.message = `Unexpected response from Home Assistant (HTTP ${response.status}).`;
          return false;
        }
      } catch {
        this.validation = "error";
        this.message =
          "Could not reach Home Assistant. Check the URL, and make sure this " +
          "origin is allowed in its http.cors_allowed_origins setting.";
        return false;
      }

      const climateSources = sources ?? {
        houseTempEntity: this.houseTempEntity,
        houseTempAttribute: this.houseTempAttribute,
        houseTargetEntity: this.houseTargetEntity,
        houseTargetAttribute: this.houseTargetAttribute,
      };

      this.url = normalized;
      this.token = trimmedToken;
      this.houseTempEntity = climateSources.houseTempEntity.trim();
      this.houseTempAttribute = climateSources.houseTempAttribute.trim();
      this.houseTargetEntity = climateSources.houseTargetEntity.trim();
      this.houseTargetAttribute = climateSources.houseTargetAttribute.trim();
      localStorage.setItem(HA_URL_KEY, this.url);
      localStorage.setItem(HA_TOKEN_KEY, this.token);
      localStorage.setItem(HA_HOUSE_TEMP_ENTITY_KEY, this.houseTempEntity);
      localStorage.setItem(HA_HOUSE_TEMP_ATTRIBUTE_KEY, this.houseTempAttribute);
      localStorage.setItem(HA_HOUSE_TARGET_ENTITY_KEY, this.houseTargetEntity);
      localStorage.setItem(HA_HOUSE_TARGET_ATTRIBUTE_KEY, this.houseTargetAttribute);
      this.validation = "valid";
      this.message = "Connected. Settings saved to this browser.";
      return true;
    },
    clear() {
      localStorage.removeItem(HA_URL_KEY);
      localStorage.removeItem(HA_TOKEN_KEY);
      localStorage.removeItem(HA_HOUSE_TEMP_ENTITY_KEY);
      localStorage.removeItem(HA_HOUSE_TEMP_ATTRIBUTE_KEY);
      localStorage.removeItem(HA_HOUSE_TARGET_ENTITY_KEY);
      localStorage.removeItem(HA_HOUSE_TARGET_ATTRIBUTE_KEY);
      this.url = "";
      this.token = "";
      this.houseTempEntity = "";
      this.houseTempAttribute = "";
      this.houseTargetEntity = "";
      this.houseTargetAttribute = "";
      this.validation = "idle";
      this.message = "";
    },
  },
});
