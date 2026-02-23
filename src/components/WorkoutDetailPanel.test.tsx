import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkoutDetailPanel } from "./WorkoutDetailPanel";

function createProps(): ComponentProps<typeof WorkoutDetailPanel> {
  return {
    language: "en" as const,
    date: "2026-02-10",
    workouts: [],
    scheduledSessions: [],
    planDays: [],
    workoutTypes: [],
    onCreate: vi.fn(),
    onPasteWorkout: vi.fn(),
    canPasteWorkout: false,
    canClearBefore: true,
    onClearBefore: vi.fn(),
    canClearAfter: true,
    onClearAfter: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCopyWorkout: vi.fn(),
    onCopyToNextWeek: vi.fn(),
    onStartWorkout: vi.fn(),
    onSkipSession: vi.fn(),
    onPreviewSession: vi.fn(),
    onResetSession: vi.fn(),
    canClearAllUncompleted: true,
    onClearAllUncompleted: vi.fn(),
  };
}

describe("WorkoutDetailPanel", () => {
  it("requests clear-after with the selected date", () => {
    const props = createProps();
    render(<WorkoutDetailPanel {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear uncompleted after" }),
    );

    expect(props.onClearAfter).toHaveBeenCalledWith("2026-02-10");
  });

  it("requests clear-before with the selected date", () => {
    const props = createProps();
    render(<WorkoutDetailPanel {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear uncompleted before" }),
    );

    expect(props.onClearBefore).toHaveBeenCalledWith("2026-02-10");
  });

  it("disables clear-after button when no future records exist", () => {
    const props = createProps();
    props.canClearAfter = false;
    render(<WorkoutDetailPanel {...props} />);

    expect(
      screen.getByRole("button", { name: "Clear uncompleted after" }),
    ).toBeDisabled();
  });

  it("disables clear-before button when no earlier records exist", () => {
    const props = createProps();
    props.canClearBefore = false;
    render(<WorkoutDetailPanel {...props} />);

    expect(
      screen.getByRole("button", { name: "Clear uncompleted before" }),
    ).toBeDisabled();
  });

  it("requests clear-all-uncompleted with the dedicated button", () => {
    const props = createProps();
    render(<WorkoutDetailPanel {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear all uncompleted sessions" }),
    );

    expect(props.onClearAllUncompleted).toHaveBeenCalled();
  });

  it("disables clear-all-uncompleted button when no uncompleted sessions exist", () => {
    const props = createProps();
    props.canClearAllUncompleted = false;
    render(<WorkoutDetailPanel {...props} />);

    expect(
      screen.getByRole("button", { name: "Clear all uncompleted sessions" }),
    ).toBeDisabled();
  });

  it("shows estimated calories for completed workouts", () => {
    const props = createProps();
    props.workoutTypes = [{ id: "lift", name: "Lift", color: "#ef476f" }];
    props.workouts = [
      {
        id: "workout-1",
        date: "2026-02-10",
        type: "lift",
        durationMin: 45,
        intensity: "medium",
        createdAt: "2026-02-10T08:00:00.000Z",
        updatedAt: "2026-02-10T08:00:00.000Z",
        sessionSummary: {
          startedAt: "2026-02-10T08:00:00.000Z",
          endedAt: "2026-02-10T08:45:00.000Z",
          totalDurationMin: 45,
          setLogs: Array.from({ length: 10 }, (_, index) => ({
            exerciseId: `e-${index}`,
            setIndex: index,
            restSecUsed: 75,
          })),
        },
      },
    ];

    render(<WorkoutDetailPanel {...props} />);

    expect(screen.getByText(/est\. 310 kcal/)).toBeVisible();
  });
});
