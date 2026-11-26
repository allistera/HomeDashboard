import { createConnection, createLongLivedTokenAuth } from "home-assistant-js-websocket";

export function openHaConnection(url: string, token: string) {
  return createConnection({ auth: createLongLivedTokenAuth(url, token) });
}
