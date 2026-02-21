import { useMemo, useState } from 'react'

import type { TemplateDayInput, TemplateExerciseInput } from '@/lib/db'
import { getCopy, type AppLanguage } from '@/lib/i18n'

import styles from './styles/TemplateEditor.module.css'

type TemplateEditorProps = {
  language: AppLanguage
  mode: 'create' | 'duplicate'
  initialName: string
  initialStartDate: string
  initialDays: TemplateDayInput[]
  onSubmit: (value: {
    name: string
    startDate: string
    days: TemplateDayInput[]
  }) => Promise<void>
  onCancel: () => void
}

type ExerciseState = TemplateExerciseInput & { uiId: string }
type DayState = {
  uiId: string
  weekday: number
  label: string
  exercises: ExerciseState[]
}

function createUiId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function toExerciseState(exercise: TemplateExerciseInput): ExerciseState {
  return {
    uiId: createUiId('exercise'),
    name: exercise.name,
    sets: exercise.sets,
    minReps: exercise.minReps,
    maxReps: exercise.maxReps,
    restSecDefault: exercise.restSecDefault,
  }
}

function toDayState(day: TemplateDayInput): DayState {
  return {
    uiId: createUiId('day'),
    weekday: day.weekday,
    label: day.label,
    exercises: day.exercises.map(toExerciseState),
  }
}

function defaultExercise(): ExerciseState {
  return {
    uiId: createUiId('exercise'),
    name: 'Exercise',
    sets: 3,
    minReps: 8,
    maxReps: 12,
    restSecDefault: 90,
  }
}

function defaultDay(): DayState {
  return {
    uiId: createUiId('day'),
    weekday: 1,
    label: 'Workout A',
    exercises: [defaultExercise()],
  }
}

function normalizeOptionalPositiveNumber(value: string): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return Math.trunc(parsed)
}

export function createDefaultTemplateDays(): TemplateDayInput[] {
  return [
    {
      weekday: 1,
      label: 'Workout A',
      exercises: [
        {
          name: 'Main lift',
          sets: 4,
          minReps: 5,
          maxReps: 8,
          restSecDefault: 120,
        },
      ],
    },
  ]
}

export function TemplateEditor({
  language,
  mode,
  initialName,
  initialStartDate,
  initialDays,
  onSubmit,
  onCancel,
}: TemplateEditorProps) {
  const copy = getCopy(language)
  const [name, setName] = useState(initialName)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [days, setDays] = useState<DayState[]>(
    initialDays.length > 0 ? initialDays.map(toDayState) : [defaultDay()],
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weekdayOptions = useMemo(
    () =>
      copy.calendar.weekdayLabels.map((label, index) => ({
        label,
        value: index + 1,
      })),
    [copy.calendar.weekdayLabels],
  )

  const submitLabel =
    mode === 'duplicate'
      ? copy.templateForm.duplicateTemplate
      : copy.templateForm.createTemplate

  const updateDay = (dayId: string, updater: (day: DayState) => DayState) => {
    setDays((current) => current.map((day) => (day.uiId === dayId ? updater(day) : day)))
  }

  const handleSubmit = async () => {
    if (!name.trim() || !startDate) {
      setError(copy.templateForm.saveTemplateError)
      return
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
    }))

    setError(null)
    setIsSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        startDate,
        days: payloadDays,
      })
    } finally {
      setIsSaving(false)
    }
  }

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
                setDays((current) => current.filter((item) => item.uiId !== day.uiId))
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
              <li key={exercise.uiId} className={styles.exerciseRow}>
                <label>
                  {copy.templateForm.exerciseName}
                  <input
                    value={exercise.name}
                    onChange={(event) =>
                      updateDay(day.uiId, (current) => ({
                        ...current,
                        exercises: current.exercises.map((item) =>
                          item.uiId === exercise.uiId
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>

                <label>
                  {copy.templateForm.sets}
                  <input
                    type="number"
                    min={1}
                    value={exercise.sets}
                    onChange={(event) =>
                      updateDay(day.uiId, (current) => ({
                        ...current,
                        exercises: current.exercises.map((item) =>
                          item.uiId === exercise.uiId
                            ? {
                                ...item,
                                sets: normalizeOptionalPositiveNumber(event.target.value) ?? 1,
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>

                <label>
                  {copy.templateForm.minReps}
                  <input
                    type="number"
                    min={1}
                    value={exercise.minReps ?? ''}
                    onChange={(event) =>
                      updateDay(day.uiId, (current) => ({
                        ...current,
                        exercises: current.exercises.map((item) =>
                          item.uiId === exercise.uiId
                            ? {
                                ...item,
                                minReps: normalizeOptionalPositiveNumber(event.target.value),
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>

                <label>
                  {copy.templateForm.maxReps}
                  <input
                    type="number"
                    min={1}
                    value={exercise.maxReps ?? ''}
                    onChange={(event) =>
                      updateDay(day.uiId, (current) => ({
                        ...current,
                        exercises: current.exercises.map((item) =>
                          item.uiId === exercise.uiId
                            ? {
                                ...item,
                                maxReps: normalizeOptionalPositiveNumber(event.target.value),
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>

                <label>
                  {copy.templateForm.restSec}
                  <input
                    type="number"
                    min={15}
                    value={exercise.restSecDefault ?? ''}
                    onChange={(event) =>
                      updateDay(day.uiId, (current) => ({
                        ...current,
                        exercises: current.exercises.map((item) =>
                          item.uiId === exercise.uiId
                            ? {
                                ...item,
                                restSecDefault: normalizeOptionalPositiveNumber(
                                  event.target.value,
                                ),
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>

                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() =>
                    updateDay(day.uiId, (current) => ({
                      ...current,
                      exercises: current.exercises.filter(
                        (item) => item.uiId !== exercise.uiId,
                      ),
                    }))
                  }
                  disabled={day.exercises.length <= 1}
                >
                  {copy.templateForm.removeExercise}
                </button>
              </li>
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
  )
}
