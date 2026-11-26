# Dedridge — Home Dashboard

A smart-home dashboard built from the "Editorial Sheet" design concepts in
`Smart Home Dashboard.html`. One dense page per area, rules instead of cards,
type carries the hierarchy.

## Pages

- **Home** (`/`) — fixed headline, home status summary, room list with light toggles, house temp,
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

## Home Assistant connection

Open **Settings** in the dashboard and enter the base URL of your Home Assistant instance and a
long-lived access token from **Profile → Security**. The dashboard stores these values in the current
browser. An HTTPS dashboard needs an HTTPS Home Assistant URL.

The dashboard uses the [Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket/)
to validate credentials, subscribe to entity updates, and send actions. It labels the disconnected
view as demo data. The warning below the top bar reports connection failures, reconnect attempts,
and failed actions.

## Home Assistant bindings

The dashboard's room, weather, presence, and security bindings are in
[`src/config/homeAssistant.ts`](src/config/homeAssistant.ts). Edit a room's `deviceAllowlist` to
choose which Home Assistant entity IDs appear in its **Devices** list and counts. Each row displays
the entity’s current state, including its unit when available. An empty list shows no devices. Room cameras and activity use Home Assistant area assignments.
Room lighting controls use the room's light bindings. Main Bedroom uses its temperature and humidity
sensor and Hue Tap Dial entities. The security camera wall discovers camera
entities. Contact sensors report open or closed. Lock controls appear only for an available
lock entity.

The homepage status summary displays the indoor average from `sensor.average_indoor_temperature`.

The drying-weather reminder reads `binary_sensor.good_drying_weather`. In Home Assistant,
**Update Drying Weather Forecast** checks the hourly forecast from `weather.home` through local
midnight every 15 minutes. The reminder displays unavailable when the forecast cannot determine
whether it will rain. The house target displays as unavailable until an entity is mapped.

The Get Jaicob shortcut is disabled in live mode until it has a Home Assistant action. The Away
shortcut turns off the mapped lights and can arm the configured alarm panel.

## Activity and cameras

The activity feed subscribes to the previous 24 hours of Home Assistant logbook history and follows
new events for `homePageBindings.activityEntityIds`. Camera previews refresh using Home Assistant's
camera-specific snapshot URLs. The expanded view uses WebRTC when the camera supports it and
falls back to the latest available snapshot.

## Commands

Use Node.js 22.22.2 or newer in the 22.x line, 24.15.0 or newer in the 24.x line, or 26 and newer.

```sh
npm install
npm run dev          # start the dev server
npm run build        # typecheck + production build
npm test             # run the Vitest suite once
npm run lint         # oxlint
npm run format       # oxfmt (ts/tsx) + prettier (everything else)
npm run format:check # verify formatting without writing
```
