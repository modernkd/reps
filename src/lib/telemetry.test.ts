import { afterEach, describe, expect, it, vi } from "vitest";

import { trackEvent } from "./telemetry";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trackEvent", () => {
  it("does not throw when telemetry storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => trackEvent("clear_after_selected_day")).not.toThrow();
  });
});
