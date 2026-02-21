import { useEffect, useMemo, useState } from 'react'

import type { AppLanguage } from '@/lib/i18n'
import { getCopy, localizeWorkoutTypeName } from '@/lib/i18n'
import type { Workout, WorkoutIntensity, WorkoutType } from '@/lib/types'

import styles from './styles/WorkoutForm.module.css'

export type WorkoutFormValue = {
  date: string
  type: string
  durationMin: number
  targetWeightKg?: number
  distanceKm?: number
  intensity?: WorkoutIntensity
  notes?: string
}

type WorkoutFormProps = {
  language: AppLanguage
  initialValue?: Workout
  defaultDate: string
  types: WorkoutType[]
  onSubmit: (value: WorkoutFormValue) => Promise<void> | void
  onCancel: () => void
}

type FieldErrors = {
  durationMin?: string
  targetWeightKg?: string
  distanceKm?: string
  type?: string
}

export function WorkoutForm({
  language,
  initialValue,
  defaultDate,
  types,
  onSubmit,
  onCancel,
}: WorkoutFormProps) {
  const copy = getCopy(language)
  const defaultType = useMemo(() => types[0]?.id ?? 'lift', [types])

  const [date, setDate] = useState(initialValue?.date ?? defaultDate)
  const [type, setType] = useState(initialValue?.type ?? defaultType)
  const [durationMin, setDurationMin] = useState(
    String(initialValue?.durationMin ?? 45),
  )
  const [targetWeightKg, setTargetWeightKg] = useState(
    initialValue?.targetWeightKg ? String(initialValue.targetWeightKg) : '',
  )
  const [distanceKm, setDistanceKm] = useState(
    initialValue?.distanceKm ? String(initialValue.distanceKm) : '',
  )
  const [intensity, setIntensity] = useState<WorkoutIntensity | ''>(
    initialValue?.intensity ?? '',
  )
  const [notes, setNotes] = useState(initialValue?.notes ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!type && defaultType) {
      setType(defaultType)
    }
  }, [type, defaultType])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FieldErrors = {}
    const parsedDuration = Number(durationMin)
    const parsedTargetWeight = targetWeightKg ? Number(targetWeightKg) : undefined
    const parsedDistance = distanceKm ? Number(distanceKm) : undefined

    if (!type) {
      nextErrors.type = copy.form.selectTypeError
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      nextErrors.durationMin = copy.form.durationError
    }

    if (
      parsedTargetWeight !== undefined &&
      (!Number.isFinite(parsedTargetWeight) || parsedTargetWeight <= 0)
    ) {
      nextErrors.targetWeightKg = copy.form.targetWeightError
    }

    if (parsedDistance !== undefined && (!Number.isFinite(parsedDistance) || parsedDistance <= 0)) {
      nextErrors.distanceKm = copy.form.distanceError
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setIsSaving(true)

    try {
      await onSubmit({
        date,
        type,
        durationMin: parsedDuration,
        targetWeightKg: parsedTargetWeight,
        distanceKm: parsedDistance,
        intensity: intensity || undefined,
        notes: notes.trim() || undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>
        {copy.form.date}
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </label>

      <label>
        {copy.form.type}
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">{copy.form.selectType}</option>
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {localizeWorkoutTypeName(item, language)}
            </option>
          ))}
        </select>
        {errors.type ? <span className={styles.error}>{errors.type}</span> : null}
      </label>

      <label>
        {copy.form.duration}
        <input
          type="number"
          min={1}
          step={1}
          value={durationMin}
          onChange={(event) => setDurationMin(event.target.value)}
        />
        {errors.durationMin ? (
          <span className={styles.error}>{errors.durationMin}</span>
        ) : null}
      </label>

      <label>
        {copy.form.targetWeight}
        <input
          type="number"
          min={0.1}
          step={0.5}
          value={targetWeightKg}
          onChange={(event) => setTargetWeightKg(event.target.value)}
        />
        {errors.targetWeightKg ? (
          <span className={styles.error}>{errors.targetWeightKg}</span>
        ) : null}
      </label>

      <label>
        {copy.form.distance}
        <input
          type="number"
          min={0}
          step={0.1}
          value={distanceKm}
          onChange={(event) => setDistanceKm(event.target.value)}
        />
        {errors.distanceKm ? (
          <span className={styles.error}>{errors.distanceKm}</span>
        ) : null}
      </label>

      <label>
        {copy.form.intensity}
        <select
          value={intensity}
          onChange={(event) => setIntensity(event.target.value as WorkoutIntensity | '')}
        >
          <option value="">{copy.form.notSet}</option>
          <option value="low">{copy.form.low}</option>
          <option value="medium">{copy.form.medium}</option>
          <option value="high">{copy.form.high}</option>
        </select>
      </label>

      <label>
        {copy.form.notes}
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder={copy.form.notesPlaceholder}
        />
      </label>

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.secondary}>
          {copy.common.cancel}
        </button>
        <button type="submit" disabled={isSaving} className={styles.primary}>
          {isSaving
            ? copy.common.saving
            : initialValue
              ? copy.form.saveChanges
              : copy.form.createWorkout}
        </button>
      </div>
    </form>
  )
}
