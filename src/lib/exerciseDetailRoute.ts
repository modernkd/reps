import type { ExerciseProgressSummary } from "./selectors";
import { getCatalogExerciseIdByName } from "./variants";

function normalizeRouteKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function addIfPresent(values: Set<string>, value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) {
    values.add(trimmed);
  }
}

export function buildExerciseDetailTarget(input: {
  key: string;
  exerciseId: string;
  name: string;
}): { routeName: string; entryKey?: string } {
  const key = input.key.trim();
  const exerciseId = input.exerciseId.trim();
  const catalogId = getCatalogExerciseIdByName(input.name);

  const routeName = exerciseId.startsWith("ex_")
    ? exerciseId
    : (catalogId ?? (exerciseId.length > 0 ? exerciseId : key));

  const normalizedRouteName = normalizeRouteKey(routeName);
  const normalizedKey = normalizeRouteKey(key);

  return {
    routeName,
    entryKey:
      normalizedKey && normalizedKey !== normalizedRouteName ? key : undefined,
  };
}

export function getExerciseDetailSeedNames(input: {
  routeName: string;
  fallbackName: string;
  entryKey?: string;
}): string[] {
  const names = new Set<string>();
  addIfPresent(names, input.fallbackName);
  addIfPresent(names, input.entryKey);
  if (!input.routeName.startsWith("ex_")) {
    addIfPresent(names, input.routeName);
  }
  return [...names];
}

export function resolveExerciseDetailEntry(input: {
  entries: ExerciseProgressSummary[];
  routeName: string;
  entryKey?: string;
}): ExerciseProgressSummary | undefined {
  const normalizedEntryKey = normalizeRouteKey(input.entryKey ?? "");
  if (normalizedEntryKey) {
    const exactEntry = input.entries.find(
      (entry) =>
        normalizeRouteKey(entry.key) === normalizedEntryKey ||
        normalizeRouteKey(entry.name) === normalizedEntryKey,
    );
    if (exactEntry) {
      return exactEntry;
    }
  }

  const normalizedRouteName = normalizeRouteKey(input.routeName);
  return input.entries.find((entry) => {
    const candidates = [
      entry.key,
      entry.exerciseId,
      getCatalogExerciseIdByName(entry.name) ?? "",
      entry.name,
    ];

    return candidates.some(
      (candidate) => normalizeRouteKey(candidate) === normalizedRouteName,
    );
  });
}
