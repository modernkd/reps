import type { Workout, WorkoutIntensity } from "./types";

const BASE_CALORIES_PER_MINUTE_BY_TYPE = {
  run: 10,
  cardio: 8,
  lift: 6,
  strength: 6.5,
  yoga: 4,
  mobility: 3.5,
} as const;

const INTENSITY_MULTIPLIER: Record<WorkoutIntensity, number> = {
  low: 0.85,
  medium: 1,
  high: 1.15,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveCaloriesPerMinute(type: string): number {
  const normalized = type.trim().toLowerCase();

  if (normalized in BASE_CALORIES_PER_MINUTE_BY_TYPE) {
    return BASE_CALORIES_PER_MINUTE_BY_TYPE[
      normalized as keyof typeof BASE_CALORIES_PER_MINUTE_BY_TYPE
    ];
  }

  if (normalized.includes("run")) {
    return BASE_CALORIES_PER_MINUTE_BY_TYPE.run;
  }
  if (normalized.includes("cardio")) {
    return BASE_CALORIES_PER_MINUTE_BY_TYPE.cardio;
  }
  if (normalized.includes("yoga")) {
    return BASE_CALORIES_PER_MINUTE_BY_TYPE.yoga;
  }
  if (normalized.includes("mobil")) {
    return BASE_CALORIES_PER_MINUTE_BY_TYPE.mobility;
  }
  if (normalized.includes("strength") || normalized.includes("lift")) {
    return BASE_CALORIES_PER_MINUTE_BY_TYPE.lift;
  }

  return BASE_CALORIES_PER_MINUTE_BY_TYPE.lift;
}

export function estimateWorkoutCaloriesBurned(
  workout: Pick<
    Workout,
    "durationMin" | "type" | "intensity" | "sessionSummary"
  >,
): number {
  const baseCaloriesPerMinute = resolveCaloriesPerMinute(workout.type);
  const intensityMultiplier = workout.intensity
    ? INTENSITY_MULTIPLIER[workout.intensity]
    : 1;
  const setCount = workout.sessionSummary?.setLogs.length ?? 0;
  const setDensityMultiplier =
    setCount > 0 ? clamp(0.9 + setCount / 40, 0.9, 1.2) : 1;

  const raw =
    workout.durationMin *
    baseCaloriesPerMinute *
    intensityMultiplier *
    setDensityMultiplier;

  return Math.max(1, Math.round(raw / 5) * 5);
}
