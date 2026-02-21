import { format, parseISO } from 'date-fns'

import type { PlanDay, ScheduledSession, Workout, WorkoutType } from '@/lib/types'

import styles from './styles/WorkoutDetailPanel.module.css'

type WorkoutDetailPanelProps = {
  date: string
  workouts: Workout[]
  scheduledSessions: ScheduledSession[]
  planDays: PlanDay[]
  workoutTypes: WorkoutType[]
  onCreate: (date: string) => void
  onPasteWorkout: (date: string) => void
  canPasteWorkout: boolean
  onEdit: (workout: Workout) => void
  onDelete: (workoutId: string) => void
  onCopyWorkout: (workout: Workout) => void
  onCopyToNextWeek: (workout: Workout) => void
  onStartWorkout: (sessionId: string) => void
  onSkipSession: (sessionId: string) => void
  onPreviewSession: (sessionId: string) => void
  onResetSession: (sessionId: string) => void
}

export function WorkoutDetailPanel({
  date,
  workouts,
  scheduledSessions,
  planDays,
  workoutTypes,
  onCreate,
  onPasteWorkout,
  canPasteWorkout,
  onEdit,
  onDelete,
  onCopyWorkout,
  onCopyToNextWeek,
  onStartWorkout,
  onSkipSession,
  onPreviewSession,
  onResetSession,
}: WorkoutDetailPanelProps) {
  const typeById = new Map(workoutTypes.map((type) => [type.id, type]))
  const dayById = new Map(planDays.map((day) => [day.id, day]))

  return (
    <section className={styles.panel} aria-label="Workout details for selected date">
      <header className={styles.header}>
        <h3>{format(parseISO(date), 'EEE, MMM d')}</h3>
        <div className={styles.headerActions}>
          {canPasteWorkout ? (
            <button type="button" className={styles.ghost} onClick={() => onPasteWorkout(date)}>
              Paste here
            </button>
          ) : null}
          <button type="button" onClick={() => onCreate(date)}>
            Add workout
          </button>
        </div>
      </header>

      <div className={styles.section}>
        <h4>Planned Sessions</h4>
        {scheduledSessions.length === 0 ? (
          <p className={styles.empty}>No planned sessions.</p>
        ) : (
          <ul className={styles.list}>
            {scheduledSessions.map((session) => {
              const planDay = dayById.get(session.planDayId)
              const isDone = session.status === 'completed'

              return (
                <li key={session.id} className={styles.item}>
                  <div>
                    <strong>{planDay?.label ?? 'Planned workout'}</strong>
                    <p>Status: {session.status.replace('_', ' ')}</p>
                  </div>
                  {!isDone ? (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onPreviewSession(session.id)}
                      >
                        Preview / edit
                      </button>
                      <button type="button" onClick={() => onStartWorkout(session.id)}>
                        {session.status === 'in_progress' ? 'Resume' : 'Start'}
                      </button>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onSkipSession(session.id)}
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <div className={styles.actions}>
                      <span className={styles.badge}>Completed</span>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onResetSession(session.id)}
                      >
                        Reset session
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h4>Completed Workouts</h4>
        {workouts.length === 0 ? (
          <p className={styles.empty}>No workouts logged for this day.</p>
        ) : (
          <ul className={styles.list}>
            {workouts.map((workout) => {
              const type = typeById.get(workout.type)
              const setWeights = workout.sessionSummary?.setLogs
                .map((setLog) => setLog.weightKg)
                .filter((value): value is number => typeof value === 'number')
              const avgWeight =
                setWeights && setWeights.length > 0
                  ? Number(
                      (
                        setWeights.reduce((acc, value) => acc + value, 0) /
                        setWeights.length
                      ).toFixed(1),
                    )
                  : null

              return (
                <li key={workout.id} className={styles.item}>
                  <div>
                    <strong>{type?.name ?? workout.type}</strong>
                    <p>
                      {workout.durationMin} min
                      {workout.distanceKm ? ` · ${workout.distanceKm} km` : ''}
                      {avgWeight ? ` · ${avgWeight} kg avg/set` : ''}
                      {workout.intensity ? ` · ${workout.intensity}` : ''}
                    </p>
                    {workout.notes ? <p className={styles.notes}>{workout.notes}</p> : null}
                  </div>
                  <div className={styles.actions}>
                    <button type="button" onClick={() => onCopyWorkout(workout)}>
                      Copy
                    </button>
                    <button type="button" onClick={() => onCopyToNextWeek(workout)}>
                      +1 week
                    </button>
                    <button type="button" onClick={() => onEdit(workout)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => onDelete(workout.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
