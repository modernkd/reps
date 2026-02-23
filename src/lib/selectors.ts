import {
  compareAsc,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subMonths,
} from "date-fns";

import {
  isDateInMonth,
  monthGridDates,
  toDateIso,
  toMonthIso,
  DATE_FORMAT,
} from "./date";
import type {
  CalendarDayModel,
  ProgressPoint,
  ScheduledSession,
  ScheduledSessionStatus,
  WeeklyTrendSeries,
  Workout,
} from "./types";

export type DateRangeInput = {
  from: string;
  to: string;
};

export type ExerciseHistoryEntry = {
  name: string;
  lastDate: string;
  lastWeightKg: number | null;
};

export type ExerciseRecordLog = {
  date: string;
  weightKg: number | null;
  setsLogged: number;
};

export type ExerciseProgressSummary = {
  key: string;
  exerciseId: string;
  name: string;
  lastRecordedAt: string | null;
  lastWeightKg: number | null;
  totalLogs: number;
  logs: ExerciseRecordLog[];
  weightPoints: Array<{ date: string; value: number }>;
};

export type ExerciseInsightMetadata = {
  equipment?: string;
  level?: string;
  primaryMuscles?: string[];
};

const MAJOR_MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
] as const;

export type MajorMuscleGroup = (typeof MAJOR_MUSCLE_GROUPS)[number];

export type WeeklyMuscleCoveragePoint = {
  weekStart: string;
  muscles: Record<MajorMuscleGroup, number>;
};

export type TrendSeriesPoint = {
  key: string;
  points: number[];
  total: number;
};

export type ExerciseInsights = {
  muscleGroups: readonly MajorMuscleGroup[];
  muscleCoverage: WeeklyMuscleCoveragePoint[];
  balance: {
    push: number;
    pull: number;
    lower: number;
  };
  equipmentTrends: TrendSeriesPoint[];
  difficultyTrends: TrendSeriesPoint[];
};

const PUSH_GROUPS = new Set<MajorMuscleGroup>([
  "chest",
  "shoulders",
  "triceps",
]);
const PULL_GROUPS = new Set<MajorMuscleGroup>(["back", "biceps"]);
const LOWER_GROUPS = new Set<MajorMuscleGroup>([
  "quads",
  "hamstrings",
  "glutes",
  "calves",
]);

const MUSCLE_ALIASES: Record<string, MajorMuscleGroup> = {
  chest: "chest",
  "middle back": "back",
  "lower back": "back",
  lats: "back",
  traps: "back",
  shoulders: "shoulders",
  delts: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  quadriceps: "quads",
  quads: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
  calves: "calves",
  abdominals: "core",
  abs: "core",
  obliques: "core",
};

function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeInsightKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createEmptyMuscleRecord(): Record<MajorMuscleGroup, number> {
  return {
    chest: 0,
    back: 0,
    shoulders: 0,
    biceps: 0,
    triceps: 0,
    quads: 0,
    hamstrings: 0,
    glutes: 0,
    calves: 0,
    core: 0,
  };
}

function resolveMajorMuscles(
  primaryMuscles: string[] | undefined,
): MajorMuscleGroup[] {
  if (!primaryMuscles || primaryMuscles.length === 0) {
    return [];
  }

  const resolved = new Set<MajorMuscleGroup>();
  for (const raw of primaryMuscles) {
    const normalized = normalizeInsightKey(raw);
    const mapped = MUSCLE_ALIASES[normalized];
    if (mapped) {
      resolved.add(mapped);
    }
  }

  return [...resolved];
}

export function getExerciseHistory(
  workouts: Workout[],
): ExerciseHistoryEntry[] {
  const sortedWorkouts = [...workouts].sort((a, b) =>
    compareAsc(parseISO(a.date), parseISO(b.date)),
  );
  const historyMap = new Map<string, ExerciseHistoryEntry>();

  for (const workout of sortedWorkouts) {
    const entryDate = parseISO(workout.date);
    for (const setLog of workout.sessionSummary?.setLogs ?? []) {
      const name = (
        setLog.exerciseName ?? fallbackExerciseName(setLog.exerciseId)
      ).trim();
      if (!name) {
        continue;
      }

      const normalized = normalizeExerciseName(name);
      const existing = historyMap.get(normalized);

      if (existing) {
        const existingDate = parseISO(existing.lastDate);
        if (compareAsc(entryDate, existingDate) < 0) {
          continue;
        }
      }

      historyMap.set(normalized, {
        name,
        lastDate: workout.date,
        lastWeightKg:
          typeof setLog.weightKg === "number" ? setLog.weightKg : null,
      });
    }
  }

  return [...historyMap.values()].sort((a, b) =>
    compareAsc(parseISO(b.lastDate), parseISO(a.lastDate)),
  );
}

export function getLatestWeightByExerciseName(
  workouts: Workout[],
): Record<string, number> {
  const sortedWorkouts = [...workouts].sort((a, b) =>
    compareAsc(parseISO(a.date), parseISO(b.date)),
  );
  const latestByExercise = new Map<string, number>();

  for (const workout of sortedWorkouts) {
    const byExerciseInWorkout = new Map<string, number>();

    for (const setLog of workout.sessionSummary?.setLogs ?? []) {
      if (typeof setLog.weightKg !== "number") {
        continue;
      }

      const normalizedName = normalizeExerciseName(
        setLog.exerciseName ?? fallbackExerciseName(setLog.exerciseId),
      );
      if (!normalizedName) {
        continue;
      }

      byExerciseInWorkout.set(normalizedName, setLog.weightKg);
    }

    for (const [name, weight] of byExerciseInWorkout.entries()) {
      latestByExercise.set(name, weight);
    }
  }

  return Object.fromEntries(latestByExercise);
}

function fallbackExerciseName(exerciseId: string): string {
  return exerciseId
    .replace(/^ex_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getExerciseProgressSummaries(input: {
  workouts: Workout[];
  typeIds?: string[];
  maxWeightPoints?: number;
  availableExerciseNames?: string[];
}): ExerciseProgressSummary[] {
  const activeTypes = input.typeIds?.length ? new Set(input.typeIds) : null;
  const byExercise = new Map<string, ExerciseProgressSummary>();
  const sortedWorkouts = [...input.workouts]
    .filter((workout) => (activeTypes ? activeTypes.has(workout.type) : true))
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));

  for (const workout of sortedWorkouts) {
    const perExercise = new Map<string, ExerciseRecordLog>();
    const perExerciseNames = new Map<string, string>();
    const perExerciseIds = new Map<string, string>();

    for (const setLog of workout.sessionSummary?.setLogs ?? []) {
      const name = (
        setLog.exerciseName ?? fallbackExerciseName(setLog.exerciseId)
      ).trim();
      if (!name) {
        continue;
      }

      const normalized = normalizeExerciseName(name);
      if (!normalized) {
        continue;
      }

      const existing = perExercise.get(normalized);
      const weightValue =
        typeof setLog.weightKg === "number" ? setLog.weightKg : null;
      if (!existing) {
        perExerciseNames.set(normalized, name);
        perExerciseIds.set(normalized, setLog.exerciseId);
        perExercise.set(normalized, {
          date: workout.date,
          weightKg: weightValue,
          setsLogged: 1,
        });
        continue;
      }

      existing.setsLogged += 1;
      if (weightValue !== null) {
        existing.weightKg =
          existing.weightKg === null
            ? weightValue
            : Math.max(existing.weightKg, weightValue);
      }
    }

    for (const [normalized, log] of perExercise.entries()) {
      const summary = byExercise.get(normalized);
      const resolvedName = perExerciseNames.get(normalized) ?? normalized;
      const resolvedId = perExerciseIds.get(normalized) ?? normalized;

      if (!summary) {
        byExercise.set(normalized, {
          key: normalized,
          exerciseId: resolvedId,
          name: resolvedName || normalized,
          lastRecordedAt: log.date,
          lastWeightKg: log.weightKg,
          totalLogs: 1,
          logs: [log],
          weightPoints:
            log.weightKg !== null
              ? [{ date: log.date, value: log.weightKg }]
              : [],
        });
        continue;
      }

      summary.logs.push(log);
      summary.totalLogs += 1;
      summary.lastRecordedAt = log.date;
      if (log.weightKg !== null) {
        summary.lastWeightKg = log.weightKg;
        summary.weightPoints.push({ date: log.date, value: log.weightKg });
      }
    }
  }

  const maxWeightPoints = input.maxWeightPoints ?? 10;
  const summaries = [...byExercise.values()].map((summary) => ({
    ...summary,
    logs: [...summary.logs].sort((a, b) =>
      compareAsc(parseISO(b.date), parseISO(a.date)),
    ),
    weightPoints: summary.weightPoints.slice(-maxWeightPoints),
  }));

  for (const exerciseName of input.availableExerciseNames ?? []) {
    const trimmed = exerciseName.trim();
    if (!trimmed) {
      continue;
    }

    const key = normalizeExerciseName(trimmed);
    if (!key || summaries.some((entry) => entry.key === key)) {
      continue;
    }

    summaries.push({
      key,
      exerciseId: key,
      name: trimmed,
      lastRecordedAt: null,
      lastWeightKg: null,
      totalLogs: 0,
      logs: [],
      weightPoints: [],
    });
  }

  return summaries.sort((a, b) => {
    if (a.lastRecordedAt && b.lastRecordedAt) {
      return compareAsc(parseISO(b.lastRecordedAt), parseISO(a.lastRecordedAt));
    }
    if (a.lastRecordedAt) {
      return -1;
    }
    if (b.lastRecordedAt) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export function getWorkoutsByDateRange(input: {
  workouts: Workout[];
  from: string;
  to: string;
  typeIds?: string[];
}): Workout[] {
  const { workouts, from, to, typeIds } = input;
  const activeTypes = typeIds?.length ? new Set(typeIds) : null;

  return workouts
    .filter((workout) => workout.date >= from && workout.date <= to)
    .filter((workout) => (activeTypes ? activeTypes.has(workout.type) : true))
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
}

export function getScheduledSessions(input: {
  sessions: ScheduledSession[];
  from: string;
  to: string;
  status?: ScheduledSessionStatus;
}): ScheduledSession[] {
  return input.sessions
    .filter((session) => session.date >= input.from && session.date <= input.to)
    .filter((session) =>
      input.status ? session.status === input.status : true,
    )
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
}

export function monthRange(month: string): DateRangeInput {
  const monthStart = parseISO(`${month}-01`);
  const from = toDateIso(startOfWeek(monthStart, { weekStartsOn: 1 }));
  const to = toDateIso(
    endOfWeek(
      new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0),
      { weekStartsOn: 1 },
    ),
  );

  return { from, to };
}

export function getCalendarMonthModel(input: {
  month: string;
  workouts: Workout[];
  sessions: ScheduledSession[];
  typeIds?: string[];
}): CalendarDayModel[] {
  const { month, workouts, sessions, typeIds } = input;
  const days = monthGridDates(month);
  const activeTypes = typeIds?.length ? new Set(typeIds) : null;

  return days.map((day) => {
    const iso = toDateIso(day);

    const dayWorkouts = workouts.filter((workout) => {
      if (workout.date !== iso) {
        return false;
      }

      return activeTypes ? activeTypes.has(workout.type) : true;
    });

    const daySessions = sessions.filter((session) => session.date === iso);

    return {
      date: iso,
      inCurrentMonth: isDateInMonth(day, month),
      workouts: dayWorkouts,
      sessions: daySessions,
    };
  });
}

export function getWeeklyTrendSeries(input: {
  workouts: Workout[];
  month: string;
  typeIds?: string[];
}): WeeklyTrendSeries {
  const end = parseISO(`${input.month}-01`);
  const from = startOfWeek(subMonths(end, 2), { weekStartsOn: 1 });
  const to = endOfWeek(new Date(end.getFullYear(), end.getMonth() + 1, 0), {
    weekStartsOn: 1,
  });

  const activeTypes = input.typeIds?.length ? new Set(input.typeIds) : null;
  const buckets = new Map<
    string,
    {
      workoutsPerWeek: number;
      totalDurationPerWeek: number;
      totalWeightKg: number;
      weightEntries: number;
    }
  >();

  let cursor = from;
  while (cursor <= to) {
    const key = format(startOfWeek(cursor, { weekStartsOn: 1 }), DATE_FORMAT);
    if (!buckets.has(key)) {
      buckets.set(key, {
        workoutsPerWeek: 0,
        totalDurationPerWeek: 0,
        totalWeightKg: 0,
        weightEntries: 0,
      });
    }
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  for (const workout of input.workouts) {
    if (activeTypes && !activeTypes.has(workout.type)) {
      continue;
    }

    const date = parseISO(workout.date);
    if (date < from || date > to) {
      continue;
    }

    const weekStart = format(
      startOfWeek(date, { weekStartsOn: 1 }),
      DATE_FORMAT,
    );
    const bucket = buckets.get(weekStart);
    if (!bucket) {
      continue;
    }

    bucket.workoutsPerWeek += 1;
    bucket.totalDurationPerWeek += workout.durationMin;
    const setWeights = workout.sessionSummary?.setLogs
      .map((setLog) => setLog.weightKg)
      .filter((value): value is number => typeof value === "number");

    if (setWeights && setWeights.length > 0) {
      bucket.totalWeightKg += setWeights.reduce((acc, value) => acc + value, 0);
      bucket.weightEntries += setWeights.length;
    }
  }

  const points = [...buckets.entries()]
    .map(([weekStart, values]) => ({
      weekStart,
      workoutsPerWeek: values.workoutsPerWeek,
      totalDurationPerWeek: values.totalDurationPerWeek,
      avgWeightKg:
        values.weightEntries > 0
          ? Number((values.totalWeightKg / values.weightEntries).toFixed(1))
          : null,
    }))
    .sort((a, b) => compareAsc(parseISO(a.weekStart), parseISO(b.weekStart)));

  return { points };
}

export function getDefaultMonth(workouts: Workout[]): string {
  const latestWorkout = [...workouts]
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
    .at(-1);

  if (latestWorkout) {
    return toMonthIso(parseISO(latestWorkout.date));
  }

  return toMonthIso(new Date());
}

export function getStrengthExerciseNames(input: {
  workouts: Workout[];
  typeId: string;
}): string[] {
  const names = new Set<string>();

  for (const workout of input.workouts) {
    if (workout.type !== input.typeId) {
      continue;
    }

    for (const setLog of workout.sessionSummary?.setLogs ?? []) {
      names.add(setLog.exerciseName ?? fallbackExerciseName(setLog.exerciseId));
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

export function getStrengthProgressSeries(input: {
  workouts: Workout[];
  typeId: string;
  exerciseName: string;
}): ProgressPoint[] {
  return input.workouts
    .filter((workout) => workout.type === input.typeId)
    .flatMap((workout) => {
      const matchingSets = (workout.sessionSummary?.setLogs ?? []).filter(
        (setLog) =>
          (
            setLog.exerciseName ?? fallbackExerciseName(setLog.exerciseId)
          ).toLowerCase() === input.exerciseName.toLowerCase() &&
          typeof setLog.weightKg === "number",
      );

      if (matchingSets.length === 0) {
        return [];
      }

      const bestSet = Math.max(
        ...matchingSets.map((setLog) => setLog.weightKg ?? 0),
      );
      return [{ date: workout.date, value: Number(bestSet.toFixed(1)) }];
    })
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
}

export function getRunProgressSeries(input: {
  workouts: Workout[];
  typeId: string;
  metric: "pace" | "speed";
}): ProgressPoint[] {
  return input.workouts
    .filter((workout) => workout.type === input.typeId)
    .filter(
      (workout) =>
        typeof workout.distanceKm === "number" && workout.distanceKm > 0,
    )
    .map((workout) => {
      const distance = workout.distanceKm as number;
      const pace = workout.durationMin / distance;
      const speed = distance / (workout.durationMin / 60);

      return {
        date: workout.date,
        value: Number((input.metric === "pace" ? pace : speed).toFixed(2)),
      };
    })
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
}

export function getExerciseInsights(input: {
  workouts: Workout[];
  weekStarts: string[];
  metadataByExercise: Record<string, ExerciseInsightMetadata | undefined>;
}): ExerciseInsights {
  const weekBucket = new Map<
    string,
    {
      muscles: Record<MajorMuscleGroup, number>;
      equipment: Record<string, number>;
      difficulty: Record<string, number>;
    }
  >();

  const equipmentTotals = new Map<string, number>();
  const difficultyTotals = new Map<string, number>();
  let pushTotal = 0;
  let pullTotal = 0;
  let lowerTotal = 0;

  for (const weekStart of input.weekStarts) {
    weekBucket.set(weekStart, {
      muscles: createEmptyMuscleRecord(),
      equipment: {},
      difficulty: {},
    });
  }

  for (const workout of input.workouts) {
    const workoutDate = parseISO(workout.date);
    const weekStart = format(
      startOfWeek(workoutDate, { weekStartsOn: 1 }),
      DATE_FORMAT,
    );
    const bucket = weekBucket.get(weekStart);
    if (!bucket) {
      continue;
    }

    for (const setLog of workout.sessionSummary?.setLogs ?? []) {
      const candidateKeys = [
        normalizeInsightKey(setLog.exerciseName ?? ""),
        normalizeInsightKey(setLog.exerciseId),
      ].filter((value) => value.length > 0);

      let metadata: ExerciseInsightMetadata | undefined;
      for (const key of candidateKeys) {
        const matched = input.metadataByExercise[key];
        if (matched) {
          metadata = matched;
          break;
        }
      }

      if (!metadata) {
        continue;
      }

      const majorMuscles = resolveMajorMuscles(metadata.primaryMuscles);
      for (const muscle of majorMuscles) {
        bucket.muscles[muscle] += 1;
      }

      const hasLower = majorMuscles.some((muscle) => LOWER_GROUPS.has(muscle));
      const hasPush = majorMuscles.some((muscle) => PUSH_GROUPS.has(muscle));
      const hasPull = majorMuscles.some((muscle) => PULL_GROUPS.has(muscle));

      if (hasLower) {
        lowerTotal += 1;
      } else if (hasPush && !hasPull) {
        pushTotal += 1;
      } else if (hasPull && !hasPush) {
        pullTotal += 1;
      } else if (hasPush && hasPull) {
        pushTotal += 0.5;
        pullTotal += 0.5;
      }

      const equipmentKey = normalizeInsightKey(metadata.equipment ?? "");
      if (equipmentKey) {
        bucket.equipment[equipmentKey] =
          (bucket.equipment[equipmentKey] ?? 0) + 1;
        equipmentTotals.set(
          equipmentKey,
          (equipmentTotals.get(equipmentKey) ?? 0) + 1,
        );
      }

      const difficultyKey = normalizeInsightKey(metadata.level ?? "");
      if (difficultyKey) {
        bucket.difficulty[difficultyKey] =
          (bucket.difficulty[difficultyKey] ?? 0) + 1;
        difficultyTotals.set(
          difficultyKey,
          (difficultyTotals.get(difficultyKey) ?? 0) + 1,
        );
      }
    }
  }

  const muscleCoverage = input.weekStarts.map((weekStart) => ({
    weekStart,
    muscles: weekBucket.get(weekStart)?.muscles ?? createEmptyMuscleRecord(),
  }));

  const topEquipmentKeys = [...equipmentTotals.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, 5)
    .map(([key]) => key);

  const equipmentTrends = topEquipmentKeys.map((key) => ({
    key,
    total: equipmentTotals.get(key) ?? 0,
    points: input.weekStarts.map(
      (weekStart) => weekBucket.get(weekStart)?.equipment[key] ?? 0,
    ),
  }));

  const preferredDifficultyOrder = [
    "beginner",
    "intermediate",
    "advanced",
    "expert",
  ];
  const orderedDifficultyKeys = preferredDifficultyOrder.filter((key) =>
    difficultyTotals.has(key),
  );
  const extraDifficultyKeys = [...difficultyTotals.keys()]
    .filter((key) => !orderedDifficultyKeys.includes(key))
    .sort((a, b) => a.localeCompare(b));
  const allDifficultyKeys = [...orderedDifficultyKeys, ...extraDifficultyKeys];

  const difficultyTrends = allDifficultyKeys.map((key) => ({
    key,
    total: difficultyTotals.get(key) ?? 0,
    points: input.weekStarts.map(
      (weekStart) => weekBucket.get(weekStart)?.difficulty[key] ?? 0,
    ),
  }));

  return {
    muscleGroups: MAJOR_MUSCLE_GROUPS,
    muscleCoverage,
    balance: {
      push: Number(pushTotal.toFixed(1)),
      pull: Number(pullTotal.toFixed(1)),
      lower: Number(lowerTotal.toFixed(1)),
    },
    equipmentTrends,
    difficultyTrends,
  };
}
