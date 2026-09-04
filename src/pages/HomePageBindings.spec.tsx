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

  it("renders the bound climate, camera and media-player state", async () => {
    const rooms = useRoomsStore();
    rooms.setHomeClimateValues(8.4, 20.7, 21.5);
    const livingRoom = rooms.rooms.find((room) => room.id === "living-room")!;
    livingRoom.media!.title = "Night Jazz";
    livingRoom.media!.playing = true;

    const frontDoor = useSecurityStore().cameras.find((camera) => camera.id === "front-door")!;
    frontDoor.live = true;
    frontDoor.snapshotUrl = "http://ha.local/front-door-snap";
    frontDoor.streamUrl = "http://ha.local/front-door-stream";

    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain("OUTSIDE 8°");
    expect(wrapper.text()).toContain("20.7°");
    expect(wrapper.text()).toContain("21.5°");
    expect(wrapper.text()).toContain("Playing · Living room");
    expect(wrapper.text()).toContain("Night Jazz");
    expect(wrapper.get(".camera__stream").attributes("src")).toContain(
      "http://ha.local/front-door-snap",
    );
    expect(wrapper.get(".camera__stream").attributes("src")).not.toContain("front-door-stream");

    await wrapper.get(".camera").trigger("click");
    expect(wrapper.get('[role="dialog"] .camera-modal__stream').attributes("src")).toBe(
      "http://ha.local/front-door-stream",
    );
    expect(document.body.style.overflow).toBe("hidden");

    await wrapper.get('[aria-label="Close camera view"]').trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
    wrapper.unmount();
  });

  it("controls the bound media player from the homepage", async () => {
    const rooms = useRoomsStore();
    const livingRoom = rooms.rooms.find((room) => room.id === "living-room")!;
    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    const pauseButton = wrapper.get('[aria-label="Pause"]');

    expect(livingRoom.media!.playing).toBe(true);
    expect(pauseButton.text()).toBe("❚❚");
    await pauseButton.trigger("click");

    expect(livingRoom.media!.playing).toBe(false);
    expect(wrapper.get('[aria-label="Play"]').text()).toBe("▶");
    expect(wrapper.text()).toContain("Paused · Living room");
  });

  it("shows only binding-backed room details and highlights rooms with lights on", () => {
    const rooms = useRoomsStore();
    const hallway = rooms.rooms.find((room) => room.id === "hallway")!;
    hallway.motion!.lastChangedAt = Date.now() - 6 * 60_000;
    const kitchen = rooms.rooms.find((room) => room.id === "kitchen")!;
    kitchen.media!.playing = false;
    kitchen.media!.active = false;

    const wrapper = mount(HomePage, { global: { plugins: [pinia] } });
    const rows = wrapper.findAll(".row");
    const rowFor = (name: string) => rows.find((row) => row.get(".row__name").text() === name)!;

    expect(rowFor("Living room").get(".row__meta").text()).toBe("21.5° · MEDIA ON");
    expect(rowFor("Kitchen").get(".row__meta").text()).toBe("21.0° · MOTION 6M AGO");
    expect(rowFor("Hallway").get(".row__meta").text()).toBe("MOTION 6M AGO");
    expect(rowFor("Bedroom").get(".row__meta").text()).toBe("19.5°");
    expect(rowFor("Living room").classes()).not.toContain("row--dim");
    expect(rowFor("Elsies Room").classes()).toContain("row--dim");
    expect(rowFor("Bedroom").classes()).toContain("row--dim");
    expect(rowFor("Kitchen").find('[role="switch"]').exists()).toBe(false);
    expect(rowFor("Jaicobs Room").find('[role="switch"]').exists()).toBe(false);
    expect(rowFor("Elsies Room").find('[role="switch"]').exists()).toBe(false);

    wrapper.unmount();
  });
});
