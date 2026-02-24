import { describe, expect, it } from "vitest";

import { shouldBlurTypeaheadOnEnter } from "./ExerciseTypeahead";

describe("ExerciseTypeahead helpers", () => {
  it("returns true when Enter is pressed without an active option", () => {
    expect(
      shouldBlurTypeaheadOnEnter({
        key: "Enter",
        activeIndex: -1,
      }),
    ).toBe(true);
  });

  it("returns false when Enter has an active option selected", () => {
    expect(
      shouldBlurTypeaheadOnEnter({
        key: "Enter",
        activeIndex: 0,
      }),
    ).toBe(false);
  });

  it("returns false for non-Enter keys", () => {
    expect(
      shouldBlurTypeaheadOnEnter({
        key: "ArrowDown",
        activeIndex: -1,
      }),
    ).toBe(false);
  });
});
