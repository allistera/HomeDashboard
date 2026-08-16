# Dedridge — Home Dashboard

A smart-home dashboard built from the "Editorial Sheet" design concepts in
`Smart Home Dashboard.html`. One dense page per area, rules instead of cards,
type carries the hierarchy.

## Pages

- **Home** (`/`) — headline status, room list with light toggles, house temp,
  front-door camera, activity feed, and scene shortcuts (Good night / Movie / Away).
- **Rooms** (`/rooms`) — room list on the left, the selected room's lights,
  blinds, climate, media, and activity as ruled rows on the right.
- **Floors** (`/floors`) — the "God View": isometric floor plans of the ground
  and first floors with live room callouts (lights, blinds, media, windows),
  a floor switcher, and a stairs shortcut. `/energy` redirects here.
- **Security** (`/security`) — arm state, camera wall, every door and window as
  a ruled row, presence, and today's events.

## Stack

- [Vue 3](https://vuejs.org) with TSX components (`@vitejs/plugin-vue-jsx`)
- TypeScript (strict)
- [Vue Router](https://router.vuejs.org) for the four pages
- [Pinia](https://pinia.vuejs.org) stores: `rooms`, `security`, `settings`, `theme`
- [Vitest](https://vitest.dev) + Vue Test Utils
- [oxlint](https://oxc.rs) for linting
- [oxfmt](https://oxc.rs) formats TypeScript/TSX; [Prettier](https://prettier.io)
  formats CSS, HTML, JSON, and Markdown

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
