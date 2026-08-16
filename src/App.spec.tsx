import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import App from "@/App";
import { router as appRouter } from "@/router";

function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: appRouter.getRoutes(),
  });
  const wrapper = mount(App, {
    global: { plugins: [createPinia(), router] },
  });
  return { wrapper, router };
}

describe("App", () => {
  it("renders the home page with the four nav links", async () => {
    const { wrapper, router } = mountApp();
    await router.isReady();
    const links = wrapper.findAll(".rail__link").map((link) => link.text());
    expect(links).toEqual(["HOME", "ROOMS", "ENERGY", "SECURITY"]);
    expect(wrapper.text()).toContain("Everything's quiet.");
  });

  it("navigates between the four pages", async () => {
    const { wrapper, router } = mountApp();
    await router.isReady();

    await router.push("/rooms");
    expect(wrapper.text()).toContain("Living room");

    await router.push("/energy");
    expect(wrapper.text()).toContain("Projected bill");

    await router.push("/security");
    expect(wrapper.text()).toContain("Secure since 7:02 PM");
  });

  it("lists who is home in the people popover", async () => {
    const { wrapper, router } = mountApp();
    await router.isReady();

    expect(wrapper.get(".topbar__people").text()).toContain("3 PEOPLE HOME");
    const popover = wrapper.get(".topbar__popover");
    expect(popover.text()).toContain("Mara");
    expect(popover.text()).toContain("Jonas");
    expect(popover.text()).toContain("Elsa");
    expect(popover.text()).not.toContain("Cleaner");
  });

  it("shows the new rooms and not the studio", async () => {
    const { wrapper, router } = mountApp();
    await router.isReady();

    await router.push("/rooms");
    expect(wrapper.text()).toContain("Jaicobs Room");
    expect(wrapper.text()).toContain("Elsies Room");
    expect(wrapper.text()).not.toContain("Studio");
  });

  it("toggles dark mode on the document root", async () => {
    const { wrapper, router } = mountApp();
    await router.isReady();
    await wrapper.get(".topbar__theme").trigger("click");
    expect(document.documentElement.dataset.theme).toBe("dark");
    await wrapper.get(".topbar__theme").trigger("click");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
