import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";

import { ChromaGrid } from "./ChromaGrid";
import { ExerciseTypeahead } from "./ExerciseTypeahead";
import styles from "./styles/ExerciseHistoryView.module.css";
import { resolveExerciseReferenceContent } from "@/lib/exerciseImages";
import { resolveFreeExerciseDbEntry } from "@/lib/exerciseImages";
import type { FreeExerciseDbEntry } from "@/lib/exerciseImages";
import { getFreeExerciseDbExerciseNames } from "@/lib/exerciseImages";
import { getCopy, getDateLocale, type AppLanguage } from "@/lib/i18n";
import { buildExerciseDetailTarget } from "@/lib/exerciseDetailRoute";
import { getExerciseProgressSummaries } from "@/lib/selectors";
import type { ExerciseProgressSummary } from "@/lib/selectors";
import type { Workout } from "@/lib/types";
import { getCatalogExerciseIdByName } from "@/lib/variants";

const CARD_GRADIENTS = [
  "linear-gradient(180deg, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.94)), linear-gradient(135deg, #4f46e5, #0f172a)",
  "linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.94)), linear-gradient(155deg, #10b981, #0f172a)",
  "linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.94)), linear-gradient(145deg, #fb923c, #0f172a)",
  "linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.94)), linear-gradient(160deg, #22d3ee, #0f172a)",
  "linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.94)), linear-gradient(170deg, #8b5cf6, #0f172a)",
  "linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.94)), linear-gradient(150deg, #fb7185, #0f172a)",
];

const INITIAL_VISIBLE_LOGS = 3;
const LOAD_MORE_STEP = 3;
const MAX_WEIGHT_POINTS = 10;
const FALLBACK_IMAGE = "/images/exercises/ex_bench_press.webp";

export type ExerciseViewFilters = {
  muscle?: string;
  equipment?: string;
  difficulty?: string;
  category?: string;
};

type ExerciseHistoryViewProps = {
  language: AppLanguage;
  workouts: Workout[];
  selectedTypeIds?: string[];
  selectedFilters: ExerciseViewFilters;
  onFiltersChange: (nextFilters: ExerciseViewFilters) => void;
  availableExerciseNames: string[];
  onAddExercise: (name: string) => Promise<void>;
};

type TimelinePoint = {
  date: string;
  value: number;
};

function WeightSparkline({ points }: { points: TimelinePoint[] }) {
  if (points.length < 2) {
    return null;
  }

  const width = 220;
  const height = 62;
  const padding = 12;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step =
    points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const path = points
    .map((point, index) => {
      const x = padding + step * index;
      const y =
        height -
        padding -
        ((point.value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const lastPoint = points[points.length - 1];
  const lastX = padding + step * (points.length - 1);
  const lastY =
    height -
    padding -
    ((lastPoint.value - min) / range) * (height - padding * 2);

  return (
    <svg
      className={styles.sparklineSvg}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Weight trend ${points.map((point) => `${point.value}kg`).join(", ")}`}
    >
      <path d={path} className={styles.sparklinePath} />
      <circle className={styles.sparklineDot} cx={lastX} cy={lastY} r="3.5" />
    </svg>
  );
}

export function ExerciseHistoryView({
  language,
  workouts,
  selectedTypeIds = [],
  selectedFilters,
  onFiltersChange,
  availableExerciseNames,
  onAddExercise,
}: ExerciseHistoryViewProps) {
  const navigate = useNavigate();
  const copy = getCopy(language);
  const dateLocale = getDateLocale(language);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [remoteExerciseSuggestions, setRemoteExerciseSuggestions] = useState<
    string[]
  >([]);
  const [enhancedSearchResults, setEnhancedSearchResults] = useState<string[]>(
    [],
  );
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
    muscles: string[];
    equipment: string[];
    difficulty: string[];
    categories: string[];
  }>({
    muscles: [],
    equipment: [],
    difficulty: [],
    categories: [],
  });

  // Enhanced search with debouncing
  useEffect(() => {
    if (!newExerciseName.trim()) {
      setEnhancedSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      import("@/lib/exerciseDb").then(({ searchExercises }) => {
        searchExercises(newExerciseName).then((results) => {
          setEnhancedSearchResults(results.map((e) => e.name));
        });
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [newExerciseName]);
  const entries = useMemo(
    () =>
      getExerciseProgressSummaries({
        workouts,
        typeIds: selectedTypeIds,
        maxWeightPoints: MAX_WEIGHT_POINTS,
        availableExerciseNames,
      }),
    [availableExerciseNames, selectedTypeIds, workouts],
  );
  const [referenceContentByExercise, setReferenceContentByExercise] = useState<
    Record<
      string,
      {
        images: string[];
        instructions: string[];
        metadata?: Pick<
          FreeExerciseDbEntry,
          | "category"
          | "equipment"
          | "force"
          | "level"
          | "mechanic"
          | "primaryMuscles"
          | "secondaryMuscles"
        >;
      }
    >
  >({});
  const addExerciseSuggestions = useMemo(() => {
    const options = new Set<string>();
    const normalized = new Set<string>();

    const addSuggestion = (candidate: string) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return;
      }

      const key = trimmed.toLowerCase();
      if (normalized.has(key)) {
        return;
      }

      normalized.add(key);
      options.add(trimmed);
    };

    // Prioritize enhanced search results
    for (const name of enhancedSearchResults) {
      addSuggestion(name);
    }
    for (const name of availableExerciseNames) {
      addSuggestion(name);
    }
    for (const name of remoteExerciseSuggestions) {
      addSuggestion(name);
    }

    return [...options].sort((left, right) => left.localeCompare(right));
  }, [
    availableExerciseNames,
    remoteExerciseSuggestions,
    enhancedSearchResults,
  ]);

  useEffect(() => {
    let cancelled = false;
    getFreeExerciseDbExerciseNames().then((names) => {
      if (cancelled) {
        return;
      }

      setRemoteExerciseSuggestions(names);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    import("@/lib/exerciseDb")
      .then(
        ({
          getAllMuscleGroups,
          getAllEquipmentTypes,
          getAllLevels,
          getAllCategories,
        }) =>
          Promise.all([
            getAllMuscleGroups(),
            getAllEquipmentTypes(),
            getAllLevels(),
            getAllCategories(),
          ]),
      )
      .then(([muscles, equipment, difficulty, categories]) => {
        if (cancelled) {
          return;
        }

        setFilterOptions({
          muscles,
          equipment,
          difficulty,
          categories,
        });
      })
      .catch(() => {
        // Keep filters usable with current values even if DB metadata fetch fails.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      entries.map(async (entry) => {
        const exerciseImageId = getCatalogExerciseIdByName(entry.name);
        const fallbackId = exerciseImageId ?? "ex_bench_press";
        const [content, dbEntry] = await Promise.all([
          resolveExerciseReferenceContent(fallbackId, entry.name),
          resolveFreeExerciseDbEntry(entry.name),
        ]);
        return [entry.key, content, dbEntry] as const;
      }),
    ).then((pairs) => {
      if (cancelled) {
        return;
      }

      const nextState: Record<
        string,
        {
          images: string[];
          instructions: string[];
          metadata?: Pick<
            FreeExerciseDbEntry,
            | "category"
            | "equipment"
            | "force"
            | "level"
            | "mechanic"
            | "primaryMuscles"
            | "secondaryMuscles"
          >;
        }
      > = {};
      for (const [entryKey, content, dbEntry] of pairs) {
        if (!content) {
          continue;
        }

        nextState[entryKey] = {
          images: content.images,
          instructions: content.instructions,
          metadata: dbEntry
            ? {
                category: dbEntry.category,
                equipment: dbEntry.equipment,
                force: dbEntry.force,
                level: dbEntry.level,
                mechanic: dbEntry.mechanic,
                primaryMuscles: dbEntry.primaryMuscles,
                secondaryMuscles: dbEntry.secondaryMuscles,
              }
            : undefined,
        };
      }
      setReferenceContentByExercise(nextState);
    });

    return () => {
      cancelled = true;
    };
  }, [entries]);

  const addExerciseByName = async (rawName: string) => {
    if (isAddingExercise) {
      return;
    }

    const nextName = rawName.trim();
    if (!nextName) {
      return;
    }

    setIsAddingExercise(true);
    try {
      await onAddExercise(nextName);
      setNewExerciseName("");
    } finally {
      setIsAddingExercise(false);
    }
  };

  const handleSubmitExercise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await addExerciseByName(newExerciseName);
  };

  const normalizeValue = (value?: string): string | undefined => {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
  };

  const hasActiveFilters = Boolean(
    selectedFilters.muscle ||
      selectedFilters.equipment ||
      selectedFilters.difficulty ||
      selectedFilters.category,
  );

  const filteredEntries = useMemo(() => {
    const selectedMuscle = normalizeValue(selectedFilters.muscle);
    const selectedEquipment = normalizeValue(selectedFilters.equipment);
    const selectedDifficulty = normalizeValue(selectedFilters.difficulty);
    const selectedCategory = normalizeValue(selectedFilters.category);

    return entries.filter((entry) => {
      if (!hasActiveFilters) {
        return true;
      }

      const metadata = referenceContentByExercise[entry.key]?.metadata;
      if (!metadata) {
        return false;
      }

      if (selectedMuscle) {
        const allMuscles = [
          ...(metadata.primaryMuscles ?? []),
          ...(metadata.secondaryMuscles ?? []),
        ]
          .map((value) => normalizeValue(value))
          .filter((value): value is string => Boolean(value));

        if (!allMuscles.includes(selectedMuscle)) {
          return false;
        }
      }

      if (selectedEquipment && normalizeValue(metadata.equipment) !== selectedEquipment) {
        return false;
      }

      if (selectedDifficulty && normalizeValue(metadata.level) !== selectedDifficulty) {
        return false;
      }

      if (selectedCategory && normalizeValue(metadata.category) !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [entries, hasActiveFilters, referenceContentByExercise, selectedFilters]);

  const formatFilterOptionLabel = (value: string): string =>
    value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

  const renderExerciseFilters = () => (
    <div className={styles.exerciseFilters}>
      <label>
        {copy.historyView.filterMuscle}
        <select
          value={selectedFilters.muscle ?? ""}
          onChange={(event) =>
            onFiltersChange({
              ...selectedFilters,
              muscle: event.target.value || undefined,
            })
          }
        >
          <option value="">{copy.historyView.filterAny}</option>
          {filterOptions.muscles.map((option) => (
            <option key={option} value={option}>
              {formatFilterOptionLabel(option)}
            </option>
          ))}
        </select>
      </label>

      <label>
        {copy.historyView.filterEquipment}
        <select
          value={selectedFilters.equipment ?? ""}
          onChange={(event) =>
            onFiltersChange({
              ...selectedFilters,
              equipment: event.target.value || undefined,
            })
          }
        >
          <option value="">{copy.historyView.filterAny}</option>
          {filterOptions.equipment.map((option) => (
            <option key={option} value={option}>
              {formatFilterOptionLabel(option)}
            </option>
          ))}
        </select>
      </label>

      <label>
        {copy.historyView.filterDifficulty}
        <select
          value={selectedFilters.difficulty ?? ""}
          onChange={(event) =>
            onFiltersChange({
              ...selectedFilters,
              difficulty: event.target.value || undefined,
            })
          }
        >
          <option value="">{copy.historyView.filterAny}</option>
          {filterOptions.difficulty.map((option) => (
            <option key={option} value={option}>
              {formatFilterOptionLabel(option)}
            </option>
          ))}
        </select>
      </label>

      <label>
        {copy.historyView.filterCategory}
        <select
          value={selectedFilters.category ?? ""}
          onChange={(event) =>
            onFiltersChange({
              ...selectedFilters,
              category: event.target.value || undefined,
            })
          }
        >
          <option value="">{copy.historyView.filterAny}</option>
          {filterOptions.categories.map((option) => (
            <option key={option} value={option}>
              {formatFilterOptionLabel(option)}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={styles.clearFilters}
        onClick={() =>
          onFiltersChange({
            muscle: undefined,
            equipment: undefined,
            difficulty: undefined,
            category: undefined,
          })
        }
        disabled={!hasActiveFilters}
      >
        {copy.historyView.clearFilters}
      </button>
    </div>
  );

  const renderAddExerciseForm = () => (
    <form className={styles.addExerciseForm} onSubmit={handleSubmitExercise}>
      <div className={styles.addExerciseRow}>
        <ExerciseTypeahead
          id="new-exercise-input"
          label={copy.historyView.addExerciseLabel}
          value={newExerciseName}
          placeholder={copy.historyView.addExercisePlaceholder}
          suggestions={addExerciseSuggestions}
          onChange={setNewExerciseName}
          onSuggestionSelect={(suggestion) => {
            void addExerciseByName(suggestion);
          }}
        />
        <button
          type="submit"
          disabled={isAddingExercise || newExerciseName.trim().length === 0}
        >
          {isAddingExercise
            ? copy.historyView.addingExercise
            : copy.historyView.addExercise}
        </button>
      </div>
    </form>
  );

  if (!entries.length) {
    return (
      <section className={styles.root}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{copy.historyView.kicker}</p>
            <h2>{copy.historyView.title}</h2>
          </div>
          <p className={styles.description}>{copy.historyView.description}</p>
        </header>
        {renderAddExerciseForm()}
        {renderExerciseFilters()}
        <div className={styles.emptyState}>{copy.historyView.emptyState}</div>
      </section>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <section className={styles.root}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{copy.historyView.kicker}</p>
            <h2>{copy.historyView.title}</h2>
          </div>
          <p className={styles.description}>{copy.historyView.description}</p>
        </header>
        {renderAddExerciseForm()}
        {renderExerciseFilters()}
        <div className={styles.emptyState}>{copy.historyView.noFilteredResults}</div>
      </section>
    );
  }

  const formattedItems = filteredEntries.map((entry, index) => {
    const referenceContent = referenceContentByExercise[entry.key];
    const exerciseImageId = getCatalogExerciseIdByName(entry.name);
    const fallbackImage = exerciseImageId
      ? `/images/exercises/${exerciseImageId}.webp`
      : FALLBACK_IMAGE;
    const referenceImages = referenceContent?.images.length
      ? referenceContent.images
      : [fallbackImage];
    const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

    return {
      image: referenceImages[0],
      images: referenceImages,
      title: entry.name,
      subtitle: entry.lastRecordedAt
        ? copy.historyView.lastRecorded(
            format(parseISO(entry.lastRecordedAt), "MMM d, yyyy", {
              locale: dateLocale,
            }),
          )
        : copy.historyView.neverRecorded,
      handle:
        entry.totalLogs > 0
          ? copy.historyView.sessionCount(entry.totalLogs)
          : undefined,
      location:
        entry.totalLogs > 0 && entry.lastWeightKg !== null
          ? copy.historyView.lastWeight(entry.lastWeightKg)
          : undefined,
      gradient,
      data: entry,
    };
  });

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{copy.historyView.kicker}</p>
          <h2>{copy.historyView.title}</h2>
        </div>
        <p className={styles.description}>{copy.historyView.description}</p>
      </header>
      {renderAddExerciseForm()}
      {renderExerciseFilters()}

      <div className={styles.gridWrapper}>
        <ChromaGrid
          items={formattedItems}
          columns={3}
          rows={2}
          className={styles.grid}
          damping={0.4}
          fadeOut={0.65}
          imageCycleHint={copy.historyView.cycleImageHint}
          onCardClick={(item) => {
            const entry = item.data as ExerciseProgressSummary | undefined;
            if (entry) {
              const target = buildExerciseDetailTarget(entry);
              const nextSearch = {
                types:
                  selectedTypeIds.length > 0
                    ? selectedTypeIds.join(",")
                    : undefined,
                exMuscle: selectedFilters.muscle,
                exEquipment: selectedFilters.equipment,
                exDifficulty: selectedFilters.difficulty,
                exCategory: selectedFilters.category,
                entryKey: target.entryKey,
              };
              const hasSearchState = Object.values(nextSearch).some(Boolean);

              navigate({
                to: "/exercises/$name",
                params: {
                  name: target.routeName,
                },
                search: hasSearchState ? nextSearch : {},
              });
            }
          }}
        />
      </div>
    </section>
  );
}
