import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { format, parseISO } from "date-fns";

import {
  readFileAsDataUrl,
  saveUploadedExerciseImage,
} from "@/lib/exerciseImages";
import type { AppLanguage } from "@/lib/i18n";
import { getCopy, getDateLocale } from "@/lib/i18n";
import {
  getCatalogExerciseVariants,
  isCustomExerciseVariant,
} from "@/lib/variants";
import { useExerciseReferenceContent } from "@/lib/useExerciseReferenceContent";
import type { SessionPlan } from "@/lib/types";
import { createId } from "@/lib/ids";
import type { ExerciseHistoryEntry } from "@/lib/selectors";

import { ExerciseSwapInsights } from "./ExerciseSwapInsights";
import styles from "./styles/SessionPlanEditor.module.css";

type SessionPlanEditorProps = {
  language: AppLanguage;
  plan: SessionPlan;
  exerciseHistory: ExerciseHistoryEntry[];
  onSave: (nextPlan: SessionPlan) => Promise<void>;
  onCancel: () => void;
};

type SessionExercise = SessionPlan["exercises"][number];

function exerciseSuggestionListId(exerciseId: string, index: number): string {
  return `session_exercise_variant_${exerciseId}_${index}`;
}

type SessionExerciseRowProps = {
  language: AppLanguage;
  exercise: SessionExercise;
  index: number;
  imageRefreshKey: number;
  onExerciseChange: (
    index: number,
    updater: (exercise: SessionExercise) => SessionExercise,
  ) => void;
  onUploadApplied: () => void;
  historyEntry?: ExerciseHistoryEntry;
};

function SessionExerciseRow({
  language,
  exercise,
  index,
  imageRefreshKey,
  onExerciseChange,
  onUploadApplied,
  historyEntry,
}: SessionExerciseRowProps) {
  const copy = getCopy(language);
  const variants = getCatalogExerciseVariants(exercise.id);
  const listId = exerciseSuggestionListId(exercise.id, index);
  const customExercise = isCustomExerciseVariant(exercise.id, exercise.name);
  const [referenceImageIndex, setReferenceImageIndex] = useState(0);
  const { content, isLoading } = useExerciseReferenceContent(
    exercise.id,
    exercise.name,
    imageRefreshKey,
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
  }, [exercise.id, exercise.name, imageRefreshKey, referenceImages.length]);

  const historyWeight =
    historyEntry && historyEntry.lastWeightKg !== null
      ? Number(historyEntry.lastWeightKg.toFixed(1))
      : null;
  const historyDateLabel = historyEntry
    ? format(parseISO(historyEntry.lastDate), "MMM d", {
        locale: getDateLocale(language),
      })
    : "";

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file || !exercise.name.trim()) {
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      saveUploadedExerciseImage(exercise.name, dataUrl);
      onUploadApplied();
    } catch {
      // Keep editor interactive even if file reading fails.
    }
  };

  return (
    <li className={styles.exerciseRow}>
      <label className={styles.exerciseIdentity}>
        {copy.sessionPlan.exerciseVariant}
        <input
          list={listId}
          value={exercise.name}
          placeholder={copy.sessionPlan.exerciseVariantPlaceholder}
          onChange={(event) =>
            onExerciseChange(index, (current) => ({
              ...current,
              name: event.target.value,
            }))
          }
        />
        <datalist id={listId}>
          {variants.map((variant) => (
            <option key={variant} value={variant} />
          ))}
        </datalist>
      </label>

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

        {customExercise ? (
          <>
            <p className={styles.referenceHint}>
              {copy.sessionPlan.customExerciseHint}
            </p>
            <label className={styles.uploadButton}>
              {copy.sessionPlan.uploadCustomImage}
              <input type="file" accept="image/*" onChange={handleUpload} />
            </label>
          </>
        ) : null}
        {historyEntry ? (
          <p className={styles.historyInfo}>
            {copy.sessionPlan.lastLogged(historyWeight, historyDateLabel)}
          </p>
        ) : null}
      </div>

      <div className={styles.metricGrid}>
        <label className={styles.metricField}>
          {copy.sessionPlan.sets}
          <input
            type="number"
            min={1}
            value={exercise.sets}
            onChange={(event) =>
              onExerciseChange(index, (current) => ({
                ...current,
                sets: Number(event.target.value) || 1,
              }))
            }
          />
        </label>

        <label className={styles.metricField}>
          {copy.sessionPlan.minReps}
          <input
            type="number"
            min={1}
            value={exercise.minReps ?? ""}
            onChange={(event) =>
              onExerciseChange(index, (current) => ({
                ...current,
                minReps: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              }))
            }
          />
        </label>

        <label className={styles.metricField}>
          {copy.sessionPlan.maxReps}
          <input
            type="number"
            min={1}
            value={exercise.maxReps ?? ""}
            onChange={(event) =>
              onExerciseChange(index, (current) => ({
                ...current,
                maxReps: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              }))
            }
          />
        </label>

        <label className={styles.metricField}>
          {copy.sessionPlan.restSec}
          <input
            type="number"
            min={15}
            value={exercise.restSecDefault ?? ""}
            onChange={(event) =>
              onExerciseChange(index, (current) => ({
                ...current,
                restSecDefault: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              }))
            }
          />
        </label>

        <label className={styles.metricField}>
          {copy.sessionPlan.targetMassKg}
          <input
            type="number"
            min={0}
            step={0.5}
            value={exercise.targetMassKg ?? ""}
            onChange={(event) =>
              onExerciseChange(index, (current) => ({
                ...current,
                targetMassKg: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              }))
            }
          />
        </label>
      </div>

      <div className={styles.swapInsights}>
        <ExerciseSwapInsights
          language={language}
          exerciseName={exercise.name}
          onSwap={(nextExerciseName) =>
            onExerciseChange(index, (current) => ({
              ...current,
              name: nextExerciseName,
            }))
          }
        />
      </div>
    </li>
  );
}

function createSessionExercise(
  overrides: Partial<SessionExercise> = {},
): SessionExercise {
  return {
    id: overrides.id ?? createId("exercise"),
    name: overrides.name ?? "",
    sets: overrides.sets ?? 3,
    minReps: overrides.minReps,
    maxReps: overrides.maxReps,
    restSecDefault: overrides.restSecDefault,
    targetMassKg: overrides.targetMassKg,
  };
}

export function SessionPlanEditor({
  language,
  plan,
  exerciseHistory,
  onSave,
  onCancel,
}: SessionPlanEditorProps) {
  const copy = getCopy(language);
  const [draft, setDraft] = useState<SessionPlan>(plan);
  const [isSaving, setIsSaving] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);
  const [selectedExistingExercise, setSelectedExistingExercise] = useState("");

  const normalized = useMemo(
    () => ({
      ...draft,
      exercises: draft.exercises.map((exercise) => ({
        ...exercise,
        sets: Math.max(1, exercise.sets),
        minReps: exercise.minReps ? Math.max(1, exercise.minReps) : undefined,
        maxReps: exercise.maxReps ? Math.max(1, exercise.maxReps) : undefined,
        restSecDefault: exercise.restSecDefault
          ? Math.max(15, exercise.restSecDefault)
          : undefined,
        targetMassKg: exercise.targetMassKg
          ? Number(Math.max(0.1, exercise.targetMassKg).toFixed(1))
          : undefined,
      })),
    }),
    [draft],
  );

  const historyLookup = useMemo(() => {
    const map = new Map<string, ExerciseHistoryEntry>();
    exerciseHistory.forEach((entry) => {
      map.set(entry.name.trim().toLowerCase(), entry);
    });
    return map;
  }, [exerciseHistory]);

  const appendExercise = (exercise: SessionExercise) => {
    setDraft((current) => ({
      ...current,
      exercises: [...current.exercises, exercise],
    }));
  };

  const handleAddHistoryExercise = () => {
    if (!selectedExistingExercise) {
      return;
    }

    const normalizedSelection = selectedExistingExercise.trim().toLowerCase();
    const historyEntry = historyLookup.get(normalizedSelection);
    if (!historyEntry) {
      return;
    }

    appendExercise(
      createSessionExercise({
        name: historyEntry.name,
      }),
    );
    setSelectedExistingExercise("");
  };

  const handleAddCustomExercise = () => {
    appendExercise(createSessionExercise());
  };

  const updateExercise = (
    index: number,
    updater: (exercise: SessionExercise) => SessionExercise,
  ) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) =>
        exerciseIndex === index ? updater(exercise) : exercise,
      ),
    }));
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(normalized);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <label>
        {copy.sessionPlan.workoutTitle}
        <input
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>

      <label>
        {copy.sessionPlan.notes}
        <textarea
          rows={3}
          placeholder={copy.sessionPlan.notesPlaceholder}
          value={draft.notes ?? ""}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              notes: event.target.value || undefined,
            }))
          }
        />
      </label>

      <div className={styles.exerciseToolbar}>
        {exerciseHistory.length > 0 ? (
          <label>
            {copy.sessionPlan.chooseExistingExercise}
            <select
              value={selectedExistingExercise}
              onChange={(event) =>
                setSelectedExistingExercise(event.target.value)
              }
            >
              <option value="">
                {copy.sessionPlan.existingExercisePlaceholder}
              </option>
              {exerciseHistory.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                  {entry.lastWeightKg !== null
                    ? ` · ${entry.lastWeightKg} kg`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className={styles.historyHint}>{copy.sessionPlan.historyEmpty}</p>
        )}
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.ghost}
            onClick={handleAddCustomExercise}
          >
            {copy.sessionPlan.addCustomExercise}
          </button>
          {exerciseHistory.length > 0 ? (
            <button
              type="button"
              className={styles.ghost}
              disabled={!selectedExistingExercise}
              onClick={handleAddHistoryExercise}
            >
              {copy.sessionPlan.addExistingExercise}
            </button>
          ) : null}
        </div>
      </div>

      <ul className={styles.exerciseList}>
        {draft.exercises.map((exercise, index) => (
          <SessionExerciseRow
            key={`${exercise.id}_${index}`}
            language={language}
            exercise={exercise}
            index={index}
            imageRefreshKey={imageRefreshKey}
            onExerciseChange={updateExercise}
            onUploadApplied={() => setImageRefreshKey((value) => value + 1)}
            historyEntry={
              exercise.name.trim()
                ? historyLookup.get(exercise.name.trim().toLowerCase())
                : undefined
            }
          />
        ))}
      </ul>

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.ghost}>
          {copy.common.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className={styles.primary}
        >
          {isSaving ? copy.common.saving : copy.sessionPlan.savePlan}
        </button>
      </div>
    </div>
  );
}
