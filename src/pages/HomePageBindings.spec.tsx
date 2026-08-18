import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import HomePage from "@/pages/HomePage";
import { useRoomsStore } from "@/stores/rooms";
import { useSecurityStore } from "@/stores/security";

describe("HomePage bindings", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("renders the bound climate, camera and media-player state", () => {
    const rooms = useRoomsStore();
    rooms.setHomeClimateValues(8.4, 20.7, 21.5);
    const kitchen = rooms.rooms.find((room) => room.id === "kitchen")!;
    kitchen.media!.title = "Night Jazz";
    kitchen.media!.playing = true;

    const frontDoor = useSecurityStore().cameras.find((camera) => camera.id === "front-door")!;
    frontDoor.live = true;
    frontDoor.streamUrl = "http://ha.local/front-door-stream";

    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain("OUTSIDE 8°");
    expect(wrapper.text()).toContain("20.7°");
    expect(wrapper.text()).toContain("21.5°");
    expect(wrapper.text()).toContain("Playing · Kitchen");
    expect(wrapper.text()).toContain("Night Jazz");
    expect(wrapper.get(".camera__stream").attributes("src")).toBe(
      "http://ha.local/front-door-stream",
    );
  });

  it("controls the bound media player from the homepage", async () => {
    const rooms = useRoomsStore();
    const kitchen = rooms.rooms.find((room) => room.id === "kitchen")!;
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });

    expect(kitchen.media!.playing).toBe(true);
    await wrapper.get('[aria-label="Pause"]').trigger("click");

    expect(kitchen.media!.playing).toBe(false);
    expect(wrapper.get('[aria-label="Play"]').attributes("aria-label")).toBe("Play");
    expect(wrapper.text()).toContain("Paused · Kitchen");
  });
});
