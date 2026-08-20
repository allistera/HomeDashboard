import { afterEach, describe, expect, it } from "vitest";
import { effectScope } from "vue";

import { useDocumentVisible } from "@/composables/useDocumentVisible";

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useDocumentVisible", () => {
  afterEach(() => {
    setVisibility("visible");
  });

  it("follows document visibility", () => {
    const scope = effectScope();
    const visible = scope.run(() => useDocumentVisible())!;
    expect(visible.value).toBe(true);

    setVisibility("hidden");
    expect(visible.value).toBe(false);

    setVisibility("visible");
    expect(visible.value).toBe(true);
    scope.stop();
  });
});
