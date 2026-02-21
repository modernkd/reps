import { useMemo, useState, type ChangeEvent } from 'react'

import {
  readFileAsDataUrl,
  saveUploadedExerciseImage,
} from '@/lib/exerciseImages'
import type { AppLanguage } from '@/lib/i18n'
import { getCopy } from '@/lib/i18n'
import {
  getCatalogExerciseVariants,
  isCustomExerciseVariant,
} from '@/lib/variants'
import { useExerciseReferenceImage } from '@/lib/useExerciseReferenceImage'
import type { SessionPlan } from '@/lib/types'

import styles from './styles/SessionPlanEditor.module.css'

type SessionPlanEditorProps = {
  language: AppLanguage
  plan: SessionPlan
  onSave: (nextPlan: SessionPlan) => Promise<void>
  onCancel: () => void
}

type SessionExercise = SessionPlan['exercises'][number]

function exerciseSuggestionListId(exerciseId: string, index: number): string {
  return `session_exercise_variant_${exerciseId}_${index}`
}

type SessionExerciseRowProps = {
  language: AppLanguage
  exercise: SessionExercise
  index: number
  imageRefreshKey: number
  onExerciseChange: (index: number, updater: (exercise: SessionExercise) => SessionExercise) => void
  onUploadApplied: () => void
}

function SessionExerciseRow({
  language,
  exercise,
  index,
  imageRefreshKey,
  onExerciseChange,
  onUploadApplied,
}: SessionExerciseRowProps) {
  const copy = getCopy(language)
  const variants = getCatalogExerciseVariants(exercise.id)
  const listId = exerciseSuggestionListId(exercise.id, index)
  const customExercise = isCustomExerciseVariant(exercise.id, exercise.name)
  const { image, isLoading } = useExerciseReferenceImage(
    exercise.id,
    exercise.name,
    imageRefreshKey,
  )

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file || !exercise.name.trim()) {
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      saveUploadedExerciseImage(exercise.name, dataUrl)
      onUploadApplied()
    } catch {
      // Keep editor interactive even if file reading fails.
    }
  }

  return (
    <li className={styles.exerciseRow}>
      <label>
        {copy.sessionPlan.exerciseVariant}
        <input
          list={listId}
          value={exercise.name}
          placeholder={copy.sessionPlan.exerciseVariantPlaceholder}
          onChange={(event) =>
            onExerciseChange(index, (current) => ({ ...current, name: event.target.value }))
          }
        />
        <datalist id={listId}>
          {variants.map((variant) => (
            <option key={variant} value={variant} />
          ))}
        </datalist>
      </label>

      <div className={styles.referenceCard}>
        {image ? (
          <img
            src={image.url}
            alt={copy.sessionPlan.referenceImageAlt(exercise.name)}
            loading="lazy"
            className={styles.referenceImage}
          />
        ) : (
          <p className={styles.referenceHint}>
            {isLoading
              ? copy.sessionPlan.loadingReferenceImage
              : copy.sessionPlan.missingReferenceImage}
          </p>
        )}

        {customExercise ? (
          <>
            <p className={styles.referenceHint}>{copy.sessionPlan.customExerciseHint}</p>
            <label className={styles.uploadButton}>
              {copy.sessionPlan.uploadCustomImage}
              <input type="file" accept="image/*" onChange={handleUpload} />
            </label>
          </>
        ) : null}
      </div>

      <label>
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

      <label>
        {copy.sessionPlan.minReps}
        <input
          type="number"
          min={1}
          value={exercise.minReps ?? ''}
          onChange={(event) =>
            onExerciseChange(index, (current) => ({
              ...current,
              minReps: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
        />
      </label>

      <label>
        {copy.sessionPlan.maxReps}
        <input
          type="number"
          min={1}
          value={exercise.maxReps ?? ''}
          onChange={(event) =>
            onExerciseChange(index, (current) => ({
              ...current,
              maxReps: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
        />
      </label>

      <label>
        {copy.sessionPlan.restSec}
        <input
          type="number"
          min={15}
          value={exercise.restSecDefault ?? ''}
          onChange={(event) =>
            onExerciseChange(index, (current) => ({
              ...current,
              restSecDefault: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
        />
      </label>
    </li>
  )
}

export function SessionPlanEditor({
  language,
  plan,
  onSave,
  onCancel,
}: SessionPlanEditorProps) {
  const copy = getCopy(language)
  const [draft, setDraft] = useState<SessionPlan>(plan)
  const [isSaving, setIsSaving] = useState(false)
  const [imageRefreshKey, setImageRefreshKey] = useState(0)

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
      })),
    }),
    [draft],
  )

  const updateExercise = (
    index: number,
    updater: (exercise: SessionExercise) => SessionExercise,
  ) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) =>
        exerciseIndex === index ? updater(exercise) : exercise,
      ),
    }))
  }

  const save = async () => {
    setIsSaving(true)
    try {
      await onSave(normalized)
    } finally {
      setIsSaving(false)
    }
  }

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
          value={draft.notes ?? ''}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              notes: event.target.value || undefined,
            }))
          }
        />
      </label>

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
          />
        ))}
      </ul>

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.ghost}>
          {copy.common.cancel}
        </button>
        <button type="button" onClick={save} disabled={isSaving} className={styles.primary}>
          {isSaving ? copy.common.saving : copy.sessionPlan.savePlan}
        </button>
      </div>
    </div>
  )
}
