import { computed, defineComponent, ref } from "vue";

import TopBar from "@/components/TopBar";
import { connectHa, disconnectHa } from "@/services/haClient";
import { applyEntities } from "@/services/haSync";
import { useHaStore } from "@/stores/ha";
import { useSettingsStore } from "@/stores/settings";

export default defineComponent({
  name: "SettingsPage",
  setup() {
    const settings = useSettingsStore();
    const ha = useHaStore();
    const url = ref(settings.url);
    const token = ref(settings.token);

    const submit = async (event: Event) => {
      event.preventDefault();
      const saved = await settings.validateAndSave(url.value, token.value);
      if (saved) await connectHa(applyEntities);
    };

    const clear = () => {
      disconnectHa();
      settings.clear();
      url.value = "";
      token.value = "";
    };

    const connectionLine = computed(() => {
      const parts = [ha.status.toUpperCase()];
      if (ha.entityCount > 0) parts.push(`${ha.entityCount} ENTITIES`);
      return parts.join(" · ");
    });

    return () => (
      <main class="main">
        <TopBar
          left={["INTEGRATIONS"]}
          status={settings.configured ? "HOME ASSISTANT LINKED" : "NOT CONNECTED"}
        />

        <div class="hero">
          <div>
            <div class="label">Integrations</div>
            <h1 class="hero__title">Settings</h1>
            <p class="hero__sub">
              Point the dashboard at your Home Assistant instance. The URL and token are validated
              against its API and stored only in this browser.
            </p>
          </div>
        </div>

        <form class="settings-form" onSubmit={submit}>
          <div class="field">
            <label class="label" for="ha-url">
              Home Assistant URL
            </label>
            <input
              id="ha-url"
              class="field__input"
              type="text"
              placeholder="http://homeassistant.local:8123"
              v-model={url.value}
            />
          </div>

          <div class="field">
            <label class="label" for="ha-token">
              Long-lived access token
            </label>
            <input
              id="ha-token"
              class="field__input"
              type="password"
              placeholder="eyJhbGciOi…"
              autocomplete="off"
              v-model={token.value}
            />
            <p class="field__hint">
              Create one in Home Assistant under your profile → Security → Long-lived access tokens.
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
            <div class="label">Live connection</div>
            <p
              class={[
                "settings-form__status",
                "mono",
                {
                  "settings-form__status--ok": ha.status === "connected",
                  "settings-form__status--error": ha.status === "error",
                },
              ]}
              role="status"
            >
              {connectionLine.value}
              {ha.message !== "" && ` — ${ha.message}`}
            </p>
            {settings.configured && ha.status !== "connected" && (
              <button
                type="button"
                class="btn btn--small"
                style={{ alignSelf: "flex-start" }}
                onClick={() => void connectHa(applyEntities)}
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
