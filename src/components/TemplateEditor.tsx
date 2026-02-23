import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

import type { TemplateDayInput, TemplateExerciseInput } from "@/lib/db";
import { getCopy, getDateLocale, type AppLanguage } from "@/lib/i18n";
import type { ExerciseHistoryEntry } from "@/lib/selectors";
import { useExerciseReferenceContent } from "@/lib/useExerciseReferenceContent";

import { ExerciseSwapInsights } from "./ExerciseSwapInsights";
import styles from "./styles/TemplateEditor.module.css";

type TemplateEditorProps = {
  language: AppLanguage;
  mode: "create" | "duplicate" | "edit";
  initialName: string;
  initialStartDate: string;
  initialDays: TemplateDayInput[];
  exerciseSuggestions: string[];
  exerciseHistory: ExerciseHistoryEntry[];
  onSubmit: (value: {
    name: string;
    startDate: string;
    days: TemplateDayInput[];
  }) => Promise<void>;
  onCancel: () => void;
};

type ExerciseState = TemplateExerciseInput & { uiId: string };
type DayState = {
  uiId: string;
  weekday: number;
  label: string;
  exercises: ExerciseState[];
};

type ExerciseRowProps = {
  language: AppLanguage;
  exercise: ExerciseState;
  suggestions: string[];
  historyEntry?: ExerciseHistoryEntry;
  onChange: (updater: (exercise: ExerciseState) => ExerciseState) => void;
  onRemove: () => void;
  disableRemove: boolean;
};

function createUiId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function toExerciseState(exercise: TemplateExerciseInput): ExerciseState {
  return {
    uiId: createUiId("exercise"),
    name: exercise.name,
    sets: exercise.sets,
    minReps: exercise.minReps,
    maxReps: exercise.maxReps,
    restSecDefault: exercise.restSecDefault,
  };
}

function toDayState(day: TemplateDayInput): DayState {
  return {
    uiId: createUiId("day"),
    weekday: day.weekday,
    label: day.label,
    exercises: day.exercises.map(toExerciseState),
  };
}

function defaultExercise(): ExerciseState {
  return {
    uiId: createUiId("exercise"),
    name: "Exercise",
    sets: 3,
    minReps: 8,
    maxReps: 12,
    restSecDefault: 90,
  };
}

function defaultDay(): DayState {
  return {
    uiId: createUiId("day"),
    weekday: 1,
    label: "Workout A",
    exercises: [defaultExercise()],
  };
}

function normalizeOptionalPositiveNumber(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getExerciseIdGuess(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return normalized ? `ex_${normalized}` : "ex_custom";
}

function TemplateExerciseRow({
  language,
  exercise,
  suggestions,
  historyEntry,
  onChange,
  onRemove,
  disableRemove,
}: ExerciseRowProps) {
  const copy = getCopy(language);
  const normalizedName = normalizeExerciseName(exercise.name);
  const [referenceImageIndex, setReferenceImageIndex] = useState(0);
  const { content, isLoading } = useExerciseReferenceContent(
    getExerciseIdGuess(exercise.name),
    exercise.name,
    normalizedName.length,
  );
  const referenceImages = content?.images ?? [];
  const currentReferenceImageIndex = referenceImages.length
    ? referenceImageIndex % referenceImages.length
    : 0;
  const activeReferenceImage = referenceImages.length
    ? referenceImages[currentReferenceImageIndex]
    : undefined;
  const canCycleReferenceImages = referenceImages.length > 1;

  useEffect(() => {
    setReferenceImageIndex(0);
  }, [exercise.uiId, exercise.name, referenceImages.length]);

  const historyWeight =
    historyEntry && historyEntry.lastWeightKg !== null
      ? Number(historyEntry.lastWeightKg.toFixed(1))
      : null;
  const historyDate = historyEntry
    ? format(parseISO(historyEntry.lastDate), "MMM d", {
        locale: getDateLocale(language),
      })
    : null;
  const listId = `template_exercise_${exercise.uiId}`;
  const isNewExercise = normalizedName.length > 0 && !historyEntry;

  return (
    <li className={styles.exerciseCard}>
      <div className={styles.cardHeader}>
        <label className={styles.nameField}>
          {copy.templateForm.exerciseName}
          <input
            list={listId}
            value={exercise.name}
            placeholder={copy.sessionPlan.exerciseVariantPlaceholder}
            onChange={(event) =>
              onChange((current) => ({ ...current, name: event.target.value }))
            }
          />
          <datalist id={listId}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
        <div className={styles.historyMeta}>
          {historyEntry && historyDate ? (
            <p className={styles.metaInfo}>
              {copy.sessionPlan.lastLogged(historyWeight, historyDate)}
            </p>
          ) : null}
          {isNewExercise ? (
            <p className={styles.newBadge}>
              {copy.sessionPlan.addCustomExercise}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.referenceCard}>
          {activeReferenceImage ? (
            <div className={styles.referenceImageFrame}>
              <button
                type="button"
                className={styles.referenceImageButton}
                onClick={() => {
                  if (!canCycleReferenceImages) {
                    return;
                  }

                  setReferenceImageIndex(
                    (current) => (current + 1) % referenceImages.length,
                  );
                }}
                aria-label={
                  canCycleReferenceImages
                    ? copy.guided.cycleReferenceImage(
                        currentReferenceImageIndex + 1,
                        referenceImages.length,
                      )
                    : copy.sessionPlan.referenceImageAlt(exercise.name)
                }
              >
                <img
                  src={activeReferenceImage}
                  alt={copy.sessionPlan.referenceImageAlt(exercise.name)}
                  loading="lazy"
                  className={styles.referenceImage}
                />
              </button>
              {canCycleReferenceImages ? (
                <span className={styles.referenceImageStep}>
                  {currentReferenceImageIndex + 1}/{referenceImages.length}
                </span>
              ) : null}
            </div>
          ) : (
            <p className={styles.referenceHint}>
              {isLoading
                ? copy.sessionPlan.loadingReferenceImage
                : copy.sessionPlan.missingReferenceImage}
            </p>
          )}
          {canCycleReferenceImages ? (
            <p className={styles.referenceCycleHint}>
              {copy.guided.cycleReferenceImage(
                currentReferenceImageIndex + 1,
                referenceImages.length,
              )}
            </p>
          ) : null}
        </div>
        <div className={styles.cardFieldGrid}>
          <label className={styles.fieldGroup}>
            {copy.templateForm.sets}
            <input
              type="number"
              min={1}
              value={exercise.sets}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  sets:
                    normalizeOptionalPositiveNumber(event.target.value) ?? 1,
                }))
              }
            />
          </label>

          <label className={styles.fieldGroup}>
            {copy.templateForm.minReps}
            <input
              type="number"
              min={1}
              value={exercise.minReps ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  minReps: normalizeOptionalPositiveNumber(event.target.value),
                }))
              }
            />
          </label>

          <label className={styles.fieldGroup}>
            {copy.templateForm.maxReps}
            <input
              type="number"
              min={1}
              value={exercise.maxReps ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  maxReps: normalizeOptionalPositiveNumber(event.target.value),
                }))
              }
            />
          </label>

          <label className={styles.fieldGroup}>
            {copy.templateForm.restSec}
            <input
              type="number"
              min={15}
              value={exercise.restSecDefault ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  restSecDefault: normalizeOptionalPositiveNumber(
                    event.target.value,
                  ),
                }))
              }
            />
          </label>
        </div>
      </div>

      <ExerciseSwapInsights
        language={language}
        exerciseName={exercise.name}
        onSwap={(nextExerciseName) =>
          onChange((current) => ({ ...current, name: nextExerciseName }))
        }
      />

      <div className={styles.cardFooter}>
        <button
          type="button"
          className={styles.ghost}
          onClick={onRemove}
          disabled={disableRemove}
        >
          {copy.templateForm.removeExercise}
        </button>
      </div>
    </li>
  );
}

export function createDefaultTemplateDays(): TemplateDayInput[] {
  return [
    {
      weekday: 1,
      label: "Workout A",
      exercises: [
        {
          name: "Main lift",
          sets: 4,
          minReps: 5,
          maxReps: 8,
          restSecDefault: 120,
        },
      ],
    },
  ];
}

export function TemplateEditor({
  language,
  mode,
  initialName,
  initialStartDate,
  initialDays,
  exerciseSuggestions,
  exerciseHistory,
  onSubmit,
  onCancel,
}: TemplateEditorProps) {
  const copy = getCopy(language);
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [days, setDays] = useState<DayState[]>(
    initialDays.length > 0 ? initialDays.map(toDayState) : [defaultDay()],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyLookup = useMemo(() => {
    const map = new Map<string, ExerciseHistoryEntry>();
    for (const entry of exerciseHistory) {
      map.set(normalizeExerciseName(entry.name), entry);
    }
    return map;
  }, [exerciseHistory]);

  const weekdayOptions = useMemo(
    () =>
      copy.calendar.weekdayLabels.map((label, index) => ({
        label,
        value: index + 1,
      })),
    [copy.calendar.weekdayLabels],
  );

  const submitLabel =
    mode === "duplicate"
      ? copy.templateForm.duplicateTemplate
      : mode === "edit"
        ? copy.templateForm.updateTemplate
        : copy.templateForm.createTemplate;

  const updateDay = (dayId: string, updater: (day: DayState) => DayState) => {
    setDays((current) =>
      current.map((day) => (day.uiId === dayId ? updater(day) : day)),
    );
  };

  const handleSubmit = async () => {
    if (isSaving) {
      return;
    }

    if (!name.trim() || !startDate) {
      setError(copy.templateForm.saveTemplateError);
      return;
    }

    const payloadDays: TemplateDayInput[] = days.map((day) => ({
      weekday: day.weekday,
      label: day.label,
      exercises: day.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        minReps: exercise.minReps,
        maxReps: exercise.maxReps,
        restSecDefault: exercise.restSecDefault,
      })),
    }));

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        startDate,
        days: payloadDays,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <label>
        {copy.templateForm.name}
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <label>
        {copy.templateForm.startDate}
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
      </label>

      {days.map((day, dayIndex) => (
        <section key={day.uiId} className={styles.dayCard}>
          <div className={styles.dayHeader}>
            <strong>
              {copy.templateForm.dayLabel} {dayIndex + 1}
            </strong>
            <button
              type="button"
              className={styles.ghost}
              onClick={() =>
                setDays((current) =>
                  current.filter((item) => item.uiId !== day.uiId),
                )
              }
              disabled={days.length <= 1}
            >
              {copy.templateForm.removeDay}
            </button>
          </div>

          <div className={styles.dayMeta}>
            <label>
              {copy.templateForm.dayLabel}
              <input
                value={day.label}
                onChange={(event) =>
                  updateDay(day.uiId, (current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              {copy.templateForm.weekday}
              <select
                value={day.weekday}
                onChange={(event) =>
                  updateDay(day.uiId, (current) => ({
                    ...current,
                    weekday: Number(event.target.value),
                  }))
                }
              >
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className={styles.exerciseList}>
            {day.exercises.map((exercise) => (
              <TemplateExerciseRow
                key={exercise.uiId}
                language={language}
                exercise={exercise}
                suggestions={exerciseSuggestions}
                historyEntry={
                  exercise.name.trim()
                    ? historyLookup.get(normalizeExerciseName(exercise.name))
                    : undefined
                }
                onChange={(exerciseUpdater) =>
                  updateDay(day.uiId, (current) => ({
                    ...current,
                    exercises: current.exercises.map((item) =>
                      item.uiId === exercise.uiId
                        ? exerciseUpdater(item)
                        : item,
                    ),
                  }))
                }
                onRemove={() =>
                  updateDay(day.uiId, (current) => ({
                    ...current,
                    exercises: current.exercises.filter(
                      (item) => item.uiId !== exercise.uiId,
                    ),
                  }))
                }
                disableRemove={day.exercises.length <= 1}
              />
            ))}
          </ul>

          <button
            type="button"
            className={styles.secondary}
            onClick={() =>
              updateDay(day.uiId, (current) => ({
                ...current,
                exercises: [...current.exercises, defaultExercise()],
              }))
            }
          >
            {copy.templateForm.addExercise}
          </button>
        </section>
      ))}

      <button
        type="button"
        className={styles.secondary}
        onClick={() => setDays((current) => [...current, defaultDay()])}
      >
        {copy.templateForm.addDay}
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.ghost}>
          {copy.common.cancel}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className={styles.primary}
        >
          {isSaving ? copy.common.saving : submitLabel}
        </button>
      </div>
    </div>
  );
}
