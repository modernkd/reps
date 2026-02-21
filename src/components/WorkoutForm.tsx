import { useEffect, useMemo, useState } from 'react'

import type { Workout, WorkoutIntensity, WorkoutType } from '@/lib/types'

import styles from './styles/WorkoutForm.module.css'

export type WorkoutFormValue = {
  date: string
  type: string
  durationMin: number
  distanceKm?: number
  intensity?: WorkoutIntensity
  notes?: string
}

type WorkoutFormProps = {
  initialValue?: Workout
  defaultDate: string
  types: WorkoutType[]
  onSubmit: (value: WorkoutFormValue) => Promise<void> | void
  onCancel: () => void
}

type FieldErrors = {
  durationMin?: string
  distanceKm?: string
  type?: string
}

export function WorkoutForm({
  initialValue,
  defaultDate,
  types,
  onSubmit,
  onCancel,
}: WorkoutFormProps) {
  const defaultType = useMemo(() => types[0]?.id ?? 'lift', [types])

  const [date, setDate] = useState(initialValue?.date ?? defaultDate)
  const [type, setType] = useState(initialValue?.type ?? defaultType)
  const [durationMin, setDurationMin] = useState(
    String(initialValue?.durationMin ?? 45),
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
    const parsedDistance = distanceKm ? Number(distanceKm) : undefined

    if (!type) {
      nextErrors.type = 'Select a workout type.'
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      nextErrors.durationMin = 'Duration must be a positive number.'
    }

    if (parsedDistance !== undefined && (!Number.isFinite(parsedDistance) || parsedDistance <= 0)) {
      nextErrors.distanceKm = 'Distance must be a positive number.'
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
        Date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </label>

      <label>
        Type
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Select type...</option>
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {errors.type ? <span className={styles.error}>{errors.type}</span> : null}
      </label>

      <label>
        Duration (min)
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
        Distance (km, optional)
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
        Intensity (optional)
        <select
          value={intensity}
          onChange={(event) => setIntensity(event.target.value as WorkoutIntensity | '')}
        >
          <option value="">Not set</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>

      <label>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Quick notes about the workout"
        />
      </label>

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.secondary}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className={styles.primary}>
          {isSaving ? 'Saving...' : initialValue ? 'Save changes' : 'Create workout'}
        </button>
      </div>
    </form>
  )
}
