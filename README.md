# Dedridge — Home Dashboard

A smart-home dashboard built from the "Editorial Sheet" design concepts in
`Smart Home Dashboard.html`. One dense page per area, rules instead of cards,
type carries the hierarchy.

## Pages

- **Home** (`/`) — headline status, room list with light toggles, house temp,
  front-door camera, activity feed, and scene shortcuts (Good night / Movie / Away).
- **Rooms** (`/rooms`) — room list on the left, the selected room's lights,
  climate, media, and activity as ruled rows on the right.
  Click a room's name or status on Home to open its details; its light toggle stays independent.
  The device list includes every device assigned directly to the room's Homey zone, with its
  type and availability. Light controls remain below the inventory. Device counts include all
  listed devices; additions, removals, renames, and zone moves update live.
- **Floors** (`/floors`) — the "God View": isometric floor plans of the ground
  and first floors with live room callouts (lights, media, windows),
  a floor switcher, and a stairs shortcut. `/energy` redirects here.
- **Security** (`/security`) — arm state, camera wall, every door and window as
  a ruled row, presence, and today's events.

## Stack

- [Vue 3](https://vuejs.org) with TSX components (`@vitejs/plugin-vue-jsx`)
- TypeScript (strict)
- [Vue Router](https://router.vuejs.org) for the four pages
- [Pinia](https://pinia.vuejs.org) stores: `activity`, `rooms`, `security`, `settings`, `theme`
- [Vitest](https://vitest.dev) + Vue Test Utils
- [oxlint](https://oxc.rs) for linting
- [oxfmt](https://oxc.rs) formats TypeScript/TSX; [Prettier](https://prettier.io)
  formats CSS, HTML, JSON, and Markdown

## Homey connection

Settings connects directly to the [Homey Web API](https://athombv.github.io/node-homey-api/HomeyAPI.html)
using a Homey address and personal access token (API key). Create the key in the Homey Web App's
Settings → API Keys and grant `homey.device.readonly`, `homey.device.control`, and `homey.zone.readonly` permissions.
Use a browser-reachable Homey address; an HTTPS dashboard requires HTTPS to avoid mixed-content
blocking. Check LAN reachability, TLS and browser access if connection validation fails.
The address and token are saved only in this browser under `dedridge.homey.*` keys. Existing
Home Assistant settings are not reused. No token belongs in source code or build-time variables.

## Homey device bindings

Page modules in `src/services/homeyBindings/` link dashboard items to exact Homey **device IDs**.
A property binding is `{ deviceId, capabilityId }`, for example:

```ts
motion: {
  deviceId: "4afb514a-cf25-4bb3-b465-7a8866fcf927",
  capabilityId: "alarm_motion",
}
```

The current inventory binds Livingroom Light and Livingroom Light 2 (power and brightness),
the downstairs and upstairs hallway lights, Toilet Light, living-room Sonos speaker, hallway motion sensor,
and toilet motion sensor. The homepage Hallway toggle controls both hallway lights and shows
on when either is on. The Toilet toggle controls Toilet Light. Living-room, hallway, and toilet light power changes appear in the live activity
feed. Add devices to the corresponding page module after verifying their IDs and
capabilities in Homey; names are display labels and never lookup keys. Lights use `onoff` and
`dim` (0–1), temperatures use `measure_temperature` / `target_temperature`, and media controls
use `speaker_playing`, `speaker_prev`, and `speaker_next`.

Homepage motion labels use each room’s verified Homey zone in `homePageBindings.roomZoneIds`,
including rooms without a directly bound sensor. Active zones show `MOTION NOW`; inactive zones
show the age of `activeLastUpdated` (the latest change to zone activity origins), refreshed every
minute. Missing zones or timestamps show `MOTION UNAVAILABLE`; sensor timestamps are never used
as a fallback. Zone changes update live and refresh after reconnecting. If zone access is denied,
light controls remain connected and Settings explains the required zone read permission.

The dashboard subscribes to device capability updates, reconciles device changes/deletions,
and destroys listeners on disconnect. Unbound or unavailable readings show as unavailable once
connected. The initial disconnected view remains a demonstration, not live home state.

## Activity and cameras

The live activity feed is generated from capability changes for
`homePageBindings.activityDeviceIds`. It starts with an empty feed on connection and collects
events while the page is connected; Home Assistant's previous 24-hour logbook is not retained.

Room cameras are discovered from their Homey zones and display refreshing snapshots. Opening
a camera starts live WebRTC video when its Homey integration exposes a camera video. The
stream stops when the overlay closes or the tab is hidden. Cameras without a live video, or
whose stream cannot connect, fall back to snapshots. This uses Homey’s video offer and
keep-alive endpoints with the existing device-read token permission; no microphone or local
camera permission is needed. Camera bindings may also supply independent MJPEG stream URLs. Alarm, presence, weather, and scene helpers must be explicitly mapped to real
Homey devices/capabilities before use; no old HA entity IDs are kept as substitute device IDs.

## Commands

```sh
npm install
npm run dev          # start the dev server
npm run build        # typecheck + production build
npm test             # run the Vitest suite once
npm run lint         # oxlint
npm run format       # oxfmt (ts/tsx) + prettier (everything else)
npm run format:check # verify formatting without writing
```
