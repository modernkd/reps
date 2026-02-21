import { differenceInSeconds, formatDistanceStrict, parseISO } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'

import { nowIso } from '@/lib/date'
import { getExerciseVariants } from '@/lib/variants'
import type {
  ActiveSessionDraft,
  ExerciseTemplate,
  PlanDay,
  ScheduledSession,
  SessionSummary,
  SetLog,
} from '@/lib/types'

import styles from './styles/GuidedWorkoutView.module.css'

type GuidedWorkoutViewProps = {
  session: ScheduledSession
  planDay: PlanDay | undefined
  exercises: ExerciseTemplate[]
  draft: ActiveSessionDraft
  onSaveDraft: (updater: (draft: ActiveSessionDraft) => ActiveSessionDraft) => Promise<void>
  onComplete: (summary: SessionSummary, notes?: string) => Promise<void>
  onAbort: () => Promise<void>
  onSwapExerciseVariant: (exerciseIndex: number, nextName: string) => Promise<void>
}

function getRemainingSeconds(restEndAt?: string, explicitRemaining?: number): number {
  if (!restEndAt) {
    return explicitRemaining ?? 0
  }

  const delta = differenceInSeconds(parseISO(restEndAt), new Date())
  return Math.max(0, delta)
}

function nextSetPosition(
  currentExerciseIndex: number,
  currentSetIndex: number,
  exercises: ExerciseTemplate[],
): { exerciseIndex: number; setIndex: number; finished: boolean } {
  const exercise = exercises[currentExerciseIndex]
  if (!exercise) {
    return { exerciseIndex: currentExerciseIndex, setIndex: currentSetIndex, finished: true }
  }

  const nextSet = currentSetIndex + 1
  if (nextSet < exercise.sets) {
    return { exerciseIndex: currentExerciseIndex, setIndex: nextSet, finished: false }
  }

  const nextExercise = currentExerciseIndex + 1
  if (nextExercise < exercises.length) {
    return { exerciseIndex: nextExercise, setIndex: 0, finished: false }
  }

  return { exerciseIndex: currentExerciseIndex, setIndex: currentSetIndex, finished: true }
}

export function GuidedWorkoutView({
  session,
  planDay,
  exercises,
  draft,
  onSaveDraft,
  onComplete,
  onAbort,
  onSwapExerciseVariant,
}: GuidedWorkoutViewProps) {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(
    draft.currentExerciseIndex,
  )
  const [currentSetIndex, setCurrentSetIndex] = useState(draft.currentSetIndex)
  const [setLogs, setSetLogs] = useState<SetLog[]>(draft.setLogs)
  const [restSecLeft, setRestSecLeft] = useState(
    getRemainingSeconds(draft.restEndAt, draft.timerRemainingSec),
  )
  const [timerPaused, setTimerPaused] = useState(draft.timerPaused)
  const [reps, setReps] = useState(8)
  const [weightKg, setWeightKg] = useState(0)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentExercise = exercises[currentExerciseIndex]
  const currentVariants = currentExercise
    ? getExerciseVariants(currentExercise.id, currentExercise.name)
    : []
  const totalSetsTarget = exercises.reduce((acc, exercise) => acc + exercise.sets, 0)
  const completedSets = setLogs.length

  useEffect(() => {
    if (!draft.restEndAt) {
      return
    }

    setRestSecLeft(getRemainingSeconds(draft.restEndAt, draft.timerRemainingSec))
  }, [draft.restEndAt, draft.timerRemainingSec])

  useEffect(() => {
    if (timerPaused || restSecLeft <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setRestSecLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [timerPaused, restSecLeft])

  const progressText = useMemo(() => {
    if (completedSets === 0) {
      return 'Start your first set.'
    }

    return `${completedSets}/${totalSetsTarget} sets logged`
  }, [completedSets, totalSetsTarget])

  const persist = async (next: {
    exerciseIndex: number
    setIndex: number
    nextSetLogs: SetLog[]
    nextRestSec: number
    nextTimerPaused: boolean
  }) => {
    const restEndAt =
      next.nextRestSec > 0 && !next.nextTimerPaused
        ? new Date(Date.now() + next.nextRestSec * 1000).toISOString()
        : undefined

    await onSaveDraft((prev) => ({
      ...prev,
      currentExerciseIndex: next.exerciseIndex,
      currentSetIndex: next.setIndex,
      setLogs: next.nextSetLogs,
      timerPaused: next.nextTimerPaused,
      timerRemainingSec: next.nextRestSec,
      restEndAt,
      updatedAt: nowIso(),
    }))
  }

  const handleCompleteSet = async () => {
    if (!currentExercise) {
      return
    }

    const targetReps = currentExercise.maxReps ?? currentExercise.minReps
    const nextLog: SetLog = {
      exerciseId: currentExercise.id,
      exerciseName: currentExercise.name,
      setIndex: currentSetIndex,
      targetReps,
      actualReps: Math.max(0, reps),
      weightKg: weightKg > 0 ? weightKg : undefined,
      restSecUsed: currentExercise.restSecDefault ?? 75,
    }

    const nextSetLogs = [...setLogs, nextLog]
    const nextPosition = nextSetPosition(
      currentExerciseIndex,
      currentSetIndex,
      exercises,
    )
    const nextRestSec = currentExercise.restSecDefault ?? 75

    setSetLogs(nextSetLogs)
    setRestSecLeft(nextRestSec)
    setTimerPaused(false)

    if (!nextPosition.finished) {
      setCurrentExerciseIndex(nextPosition.exerciseIndex)
      setCurrentSetIndex(nextPosition.setIndex)
    }

    await persist({
      exerciseIndex: nextPosition.exerciseIndex,
      setIndex: nextPosition.setIndex,
      nextSetLogs,
      nextRestSec,
      nextTimerPaused: false,
    })
  }

  const updateTimer = async (nextSec: number, paused: boolean) => {
    setRestSecLeft(nextSec)
    setTimerPaused(paused)

    await persist({
      exerciseIndex: currentExerciseIndex,
      setIndex: currentSetIndex,
      nextSetLogs: setLogs,
      nextRestSec: nextSec,
      nextTimerPaused: paused,
    })
  }

  const handleFinish = async () => {
    setIsSubmitting(true)
    try {
      const endedAt = nowIso()
      const minutes = Math.max(
        1,
        Math.round(
          differenceInSeconds(parseISO(endedAt), parseISO(draft.startedAt)) / 60,
        ),
      )

      await onComplete(
        {
          startedAt: draft.startedAt,
          endedAt,
          totalDurationMin: minutes,
          setLogs,
        },
        notes || undefined,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={styles.wrapper} aria-label="Guided workout mode">
      <header className={styles.header}>
        <div>
          <h2>{planDay?.label ?? 'Guided Workout'}</h2>
          <p>
            Session date {session.date} · {progressText}
          </p>
        </div>
        <button type="button" className={styles.abort} onClick={onAbort}>
          End session
        </button>
      </header>

      <article className={styles.card}>
        <h3>{currentExercise?.name ?? 'All exercises complete'}</h3>
        <p>
          Set {currentSetIndex + 1}
          {currentExercise ? ` of ${currentExercise.sets}` : ''}
          {currentExercise?.minReps || currentExercise?.maxReps
            ? ` · target ${currentExercise.minReps ?? currentExercise.maxReps}-${currentExercise.maxReps ?? currentExercise.minReps} reps`
            : ''}
        </p>

        {currentExercise ? (
          <label className={styles.variantControl}>
            Variant
            <select
              value={currentExercise.name}
              onChange={(event) =>
                onSwapExerciseVariant(currentExerciseIndex, event.target.value)
              }
            >
              {currentVariants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className={styles.repControls}>
          <button type="button" onClick={() => setReps((value) => Math.max(0, value - 1))}>
            -
          </button>
          <input
            type="number"
            min={0}
            value={reps}
            onChange={(event) => setReps(Number(event.target.value) || 0)}
          />
          <button type="button" onClick={() => setReps((value) => value + 1)}>
            +
          </button>
          <span>reps</span>
        </div>

        <label className={styles.weightControl}>
          Weight for this set (kg)
          <input
            type="number"
            min={0}
            step={0.5}
            value={weightKg}
            onChange={(event) => setWeightKg(Number(event.target.value) || 0)}
          />
        </label>

        <button
          type="button"
          className={styles.completeSet}
          onClick={handleCompleteSet}
          disabled={!currentExercise}
        >
          Complete set and continue
        </button>
      </article>

      <article className={styles.timerCard}>
        <h3>Rest timer</h3>
        <p className={styles.timerValue}>
          {formatDistanceStrict(0, restSecLeft * 1000, { unit: 'second' })}
        </p>
        <div className={styles.timerActions}>
          <button
            type="button"
            onClick={() => updateTimer(restSecLeft, !timerPaused)}
            disabled={restSecLeft <= 0}
          >
            {timerPaused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" onClick={() => updateTimer(restSecLeft + 15, false)}>
            +15s
          </button>
          <button type="button" onClick={() => updateTimer(0, true)}>
            Reset
          </button>
        </div>
      </article>

      <label className={styles.notes}>
        Session notes
        <textarea
          rows={3}
          placeholder="How did the session feel?"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.finish}
          onClick={handleFinish}
          disabled={setLogs.length === 0 || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Finish workout'}
        </button>
      </footer>
    </section>
  )
}
