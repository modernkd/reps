import { describe, expect, it } from "vitest";

import { matchesExerciseSearch } from "./ExerciseHistoryView";

describe("ExerciseHistoryView helpers", () => {
  it("matches by exercise name", () => {
    expect(
      matchesExerciseSearch({
        searchFilter: "back",
        entryName: "Back Extension",
      }),
    ).toBe(true);
  });

  it("matches by targeted muscle groups", () => {
    expect(
      matchesExerciseSearch({
        searchFilter: "back",
        entryName: "Pull Up",
        metadata: {
          category: "strength",
          equipment: "body only",
          force: "pull",
          level: "intermediate",
          mechanic: "compound",
          primaryMuscles: ["lats"],
          secondaryMuscles: ["middle back"],
        },
      }),
    ).toBe(true);
  });

  it("does not match when neither name nor muscles include the search text", () => {
    expect(
      matchesExerciseSearch({
        searchFilter: "back",
        entryName: "Bench Press",
        metadata: {
          category: "strength",
          equipment: "barbell",
          force: "push",
          level: "intermediate",
          mechanic: "compound",
          primaryMuscles: ["chest"],
          secondaryMuscles: ["triceps"],
        },
      }),
    ).toBe(false);
  });
});
