import { isAlias, isMap, isScalar, isSeq, parseDocument, type Node } from "yaml";
import type { HomeyConfig } from "@/services/homeyBindings/homeyConfig";

interface ConfigRule {
  kind: "string" | "count" | "object" | "array" | "dictionary";
  fields?: Record<string, ConfigRule>;
  item?: ConfigRule;
}

const text: ConfigRule = { kind: "string" };
const property: ConfigRule = {
  kind: "object",
  fields: { deviceId: text, capabilityId: text },
};
const texts: ConfigRule = { kind: "array", item: text };
const schema: ConfigRule = {
  kind: "object",
  fields: {
    home: {
      kind: "object",
      fields: {
        "outsideTemperature?": property,
        "houseTemperature?": property,
        "houseTarget?": property,
        "washingWeather?": property,
        outsideTemperatureTokenId: text,
        camera: { kind: "object", fields: { cameraId: text, "deviceId?": text } },
        mediaPlayer: { kind: "object", fields: { roomId: text, deviceId: text } },
        activityDeviceIds: texts,
        excludedRoomIds: texts,
        roomZoneIds: { kind: "dictionary", item: text },
      },
    },
    rooms: {
      kind: "array",
      item: {
        kind: "object",
        fields: {
          roomId: text,
          "name?": text,
          "floor?": text,
          lights: {
            kind: "array",
            item: { kind: "object", fields: { lightId: text, deviceId: text } },
          },
          "temperature?": property,
          "climate?": property,
          "motion?": property,
          "vacuum?": property,
          "media?": text,
        },
      },
    },
    floors: {
      kind: "object",
      fields: {
        kitchenRoomId: text,
        livingRoomId: text,
        hallwayRoomId: text,
        bedroomRoomIds: texts,
        jaicobsRoomId: text,
      },
    },
    security: {
      kind: "object",
      fields: {
        sensorCount: { kind: "count" },
        "alarmControlPanel?": {
          kind: "object",
          fields: {
            deviceId: text,
            capabilityId: text,
            states: { kind: "object", fields: { home: text, away: text, disarmed: text } },
          },
        },
        entries: {
          kind: "array",
          item: {
            kind: "object",
            fields: { entryId: text, "lock?": property, "sensor?": property },
          },
        },
        people: {
          kind: "array",
          item: { kind: "object", fields: { personId: text, presence: property } },
        },
        cameras: {
          kind: "array",
          item: {
            kind: "object",
            fields: { cameraId: text, deviceId: text, "snapshotUrl?": text, "streamUrl?": text },
          },
        },
      },
    },
  },
};

export function parseHomeyConfig(source: string): HomeyConfig {
  const document = parseDocument(source);
  if (document.errors.length) throw new Error(`Invalid homey.yaml: ${document.errors[0].message}`);
  const fail = (path: string, expected: string): never => {
    throw new Error(`Invalid homey.yaml at ${path}: expected ${expected}`);
  };
  const validate = (
    input: Node | null | undefined,
    rule: ConfigRule,
    path: string,
    depth = 0,
  ): void => {
    if (depth > 64) fail(path, "a non-circular configuration");
    const node = isAlias(input) ? input.resolve(document) : input;
    if (rule.kind === "string") {
      if (!isScalar(node) || node.value !== String(node.value) || !String(node.value).trim())
        fail(path, "a non-empty string");
    } else if (rule.kind === "count") {
      if (!isScalar(node) || !Number.isInteger(node.value) || Number(node.value) < 0)
        fail(path, "a non-negative integer");
    } else if (rule.kind === "array") {
      if (!isSeq<Node>(node)) return fail(path, "an array");
      node.items.forEach((item, index) =>
        validate(item, rule.item!, `${path}[${index}]`, depth + 1),
      );
    } else {
      if (!isMap<Node, Node>(node)) return fail(path, "an object");
      if (rule.kind === "dictionary") {
        for (const pair of node.items) {
          validate(pair.key, text, `${path} key`, depth + 1);
          validate(pair.value, rule.item!, `${path}.${String(pair.key)}`, depth + 1);
        }
      } else {
        const allowed = new Set(Object.keys(rule.fields!).map((key) => key.replace(/\?$/, "")));
        for (const pair of node.items) {
          if (!isScalar(pair.key) || !allowed.has(String(pair.key.value)))
            fail(path, `known fields (${[...allowed].join(", ")})`);
        }
        for (const [field, child] of Object.entries(rule.fields!)) {
          const key = field.replace(/\?$/, "");
          if (field.endsWith("?") && !node.has(key)) continue;
          validate(node.get(key, true), child, `${path}.${key}`, depth + 1);
        }
      }
    }
  };
  validate(document.contents, schema, "config");
  // The YAML tree has been validated above, including aliases, before crossing this boundary.
  const config: HomeyConfig = document.toJS({ maxAliasCount: 100 });
  const roomIds = new Set(config.rooms.map((room) => room.roomId));
  if (roomIds.size !== config.rooms.length) fail("config.rooms", "unique room IDs");
  for (const id of [
    ...Object.keys(config.home.roomZoneIds),
    ...config.home.excludedRoomIds,
    ...Object.values(config.floors).flat(),
    config.home.mediaPlayer.roomId,
  ]) {
    if (!roomIds.has(id)) fail("config", `a mapped room ID (${id})`);
  }
  if (!config.security.cameras.some((camera) => camera.cameraId === config.home.camera.cameraId))
    fail("config.home.camera.cameraId", "a mapped camera ID");
  return config;
}
