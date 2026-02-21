import { useMemo, useState } from 'react'

import { getExerciseVariants } from '@/lib/variants'
import type { SessionPlan } from '@/lib/types'

import styles from './styles/SessionPlanEditor.module.css'

type SessionPlanEditorProps = {
  plan: SessionPlan
  onSave: (nextPlan: SessionPlan) => Promise<void>
  onCancel: () => void
}

export function SessionPlanEditor({ plan, onSave, onCancel }: SessionPlanEditorProps) {
  const [draft, setDraft] = useState<SessionPlan>(plan)
  const [isSaving, setIsSaving] = useState(false)

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
        Workout title
        <input
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>

      <label>
        Notes
        <textarea
          rows={3}
          placeholder="Optional notes before starting"
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
        {draft.exercises.map((exercise, index) => {
          const variants = getExerciseVariants(exercise.id, exercise.name)

          return (
            <li key={`${exercise.id}_${index}`} className={styles.exerciseRow}>
              <label>
                Exercise variant
                <select
                  value={exercise.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exercises: current.exercises.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item,
                      ),
                    }))
                  }
                >
                  {variants.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sets
                <input
                  type="number"
                  min={1}
                  value={exercise.sets}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exercises: current.exercises.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, sets: Number(event.target.value) || 1 }
                          : item,
                      ),
                    }))
                  }
                />
              </label>

              <label>
                Min reps
                <input
                  type="number"
                  min={1}
                  value={exercise.minReps ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exercises: current.exercises.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              minReps: event.target.value
                                ? Number(event.target.value)
                                : undefined,
                            }
                          : item,
                      ),
                    }))
                  }
                />
              </label>

              <label>
                Max reps
                <input
                  type="number"
                  min={1}
                  value={exercise.maxReps ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exercises: current.exercises.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              maxReps: event.target.value
                                ? Number(event.target.value)
                                : undefined,
                            }
                          : item,
                      ),
                    }))
                  }
                />
              </label>

              <label>
                Rest (sec)
                <input
                  type="number"
                  min={15}
                  value={exercise.restSecDefault ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exercises: current.exercises.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              restSecDefault: event.target.value
                                ? Number(event.target.value)
                                : undefined,
                            }
                          : item,
                      ),
                    }))
                  }
                />
              </label>
            </li>
          )
        })}
      </ul>

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.ghost}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={isSaving} className={styles.primary}>
          {isSaving ? 'Saving...' : 'Save plan'}
        </button>
      </div>
    </div>
  )
}
