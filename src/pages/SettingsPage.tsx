import { computed, defineComponent, ref } from "vue";

import TopBar from "@/components/TopBar";
import { connectHomey, disconnectHomey } from "@/services/homeyClient";
import { applyDevices } from "@/services/homeySync";
import { useHomeyStore } from "@/stores/homey";
import { useZonesStore } from "@/stores/zones";
import { useSettingsStore } from "@/stores/settings";

export default defineComponent({
  name: "SettingsPage",
  setup() {
    const settings = useSettingsStore();
    const homey = useHomeyStore();
    const zones = useZonesStore();
    const url = ref(settings.url);
    const token = ref(settings.token);

    const submit = async (event: Event) => {
      event.preventDefault();
      const saved = await settings.validateAndSave(url.value, token.value);
      if (saved) await connectHomey(applyDevices);
    };

    const clear = () => {
      disconnectHomey();
      settings.clear();
      url.value = "";
      token.value = "";
    };

    const connectionLine = computed(() => {
      const parts = [homey.status.toUpperCase()];
      if (homey.deviceCount > 0) parts.push(`${homey.deviceCount} DEVICES`);
      return parts.join(" · ");
    });

    return () => (
      <main class="main">
        <TopBar
          left={["INTEGRATIONS"]}
          status={homey.status === "connected" ? "HOMEY CONNECTED" : "NOT CONNECTED"}
        />

        <div class="hero">
          <div>
            <div class="label">Integrations</div>
            <h1 class="hero__title">Settings</h1>
            <p class="hero__sub">
              Point the dashboard at your Homey instance. The URL and token are validated against
              its API and stored only in this browser.
            </p>
          </div>
        </div>

        <form class="settings-form" onSubmit={submit}>
          <div class="field">
            <label class="label" for="homey-url">
              Homey URL
            </label>
            <input
              id="homey-url"
              class="field__input"
              type="text"
              placeholder="https://your-homey-address"
              v-model={url.value}
            />
          </div>

          <div class="field">
            <label class="label" for="homey-token">
              Personal access token
            </label>
            <input
              id="homey-token"
              class="field__input"
              type="password"
              placeholder="eyJhbGciOi…"
              autocomplete="off"
              v-model={token.value}
            />
            <p class="field__hint">
              Create one in the Homey Web App under Settings → API Keys. Grant device read and
              control permissions, plus zone read permission for room activity.
            </p>
          </div>

          <div class="settings-form__actions">
            <button
              type="submit"
              class="btn btn--primary"
              disabled={settings.validation === "checking"}
            >
              {settings.validation === "checking" ? "Checking…" : "Validate & save"}
            </button>
            {settings.configured && (
              <button type="button" class="btn" onClick={clear}>
                Clear saved settings
              </button>
            )}
          </div>

          {settings.message !== "" && (
            <p
              class={[
                "settings-form__status",
                "mono",
                {
                  "settings-form__status--ok": settings.validation === "valid",
                  "settings-form__status--error": settings.validation === "error",
                },
              ]}
              role="status"
            >
              {settings.message}
            </p>
          )}

          <div class="connection">
            {zones.unavailable && (
              <p role="status">
                Zone activity unavailable. Check the API key's zone read permission and reconnect.
              </p>
            )}
            <div class="label">Live connection</div>
            <p
              class={[
                "settings-form__status",
                "mono",
                {
                  "settings-form__status--ok": homey.status === "connected",
                  "settings-form__status--error": homey.status === "error",
                },
              ]}
              role="status"
            >
              {connectionLine.value}
              {homey.message !== "" && ` — ${homey.message}`}
            </p>
            {settings.configured && homey.status !== "connected" && (
              <button
                type="button"
                class="btn btn--small"
                style={{ alignSelf: "flex-start" }}
                onClick={() => void connectHomey(applyDevices)}
              >
                Reconnect
              </button>
            )}
          </div>
        </form>
      </main>
    );
  },
});
