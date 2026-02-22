import { format, parseISO } from "date-fns";

import type { AppLanguage } from "@/lib/i18n";
import {
  getCopy,
  getDateLocale,
  localizeIntensity,
  localizeSessionStatus,
  localizeWorkoutTypeName,
} from "@/lib/i18n";
import { estimateWorkoutCaloriesBurned } from "@/lib/calories";
import type {
  PlanDay,
  ScheduledSession,
  Workout,
  WorkoutType,
} from "@/lib/types";

import styles from "./styles/WorkoutDetailPanel.module.css";

type WorkoutDetailPanelProps = {
  language: AppLanguage;
  date: string;
  workouts: Workout[];
  scheduledSessions: ScheduledSession[];
  planDays: PlanDay[];
  workoutTypes: WorkoutType[];
  onCreate: (date: string) => void;
  onPasteWorkout: (date: string) => void;
  canPasteWorkout: boolean;
  canClearBefore: boolean;
  onClearBefore: (date: string) => void;
  canClearAfter: boolean;
  onClearAfter: (date: string) => void;
  onEdit: (workout: Workout) => void;
  onDelete: (workoutId: string) => void;
  onCopyWorkout: (workout: Workout) => void;
  onCopyToNextWeek: (workout: Workout) => void;
  onStartWorkout: (sessionId: string) => void;
  onSkipSession: (sessionId: string) => void;
  onPreviewSession: (sessionId: string) => void;
  onResetSession: (sessionId: string) => void;
  canClearAllUncompleted: boolean;
  onClearAllUncompleted: () => void;
};

export function WorkoutDetailPanel({
  language,
  date,
  workouts,
  scheduledSessions,
  planDays,
  workoutTypes,
  onCreate,
  onPasteWorkout,
  canPasteWorkout,
  canClearBefore,
  onClearBefore,
  canClearAfter,
  onClearAfter,
  onEdit,
  onDelete,
  onCopyWorkout,
  onCopyToNextWeek,
  onStartWorkout,
  onSkipSession,
  onPreviewSession,
  onResetSession,
  canClearAllUncompleted,
  onClearAllUncompleted,
}: WorkoutDetailPanelProps) {
  const copy = getCopy(language);
  const dateLocale = getDateLocale(language);
  const typeById = new Map(workoutTypes.map((type) => [type.id, type]));
  const dayById = new Map(planDays.map((day) => [day.id, day]));
  const completedSessionsCount = scheduledSessions.filter(
    (session) => session.status === "completed",
  ).length;
  const uncompletedSessionsCount =
    scheduledSessions.length - completedSessionsCount;

  return (
    <section className={styles.panel} aria-label={copy.details.sectionAria}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h3>
            {format(parseISO(date), "EEE, MMM d", { locale: dateLocale })}
          </h3>
          <div className={styles.stats} aria-label="Daily summary">
            <span className={styles.statPill}>
              {uncompletedSessionsCount} open
            </span>
            <span className={styles.statPill}>{workouts.length} completed</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => onCreate(date)}
          >
            {copy.details.addWorkout}
          </button>
          {canPasteWorkout ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => onPasteWorkout(date)}
            >
              {copy.details.pasteHere}
            </button>
          ) : null}
          <details className={styles.bulkActions}>
            <summary
              aria-label={`${copy.details.clearBefore} / ${copy.details.clearAfter}`}
            >
              ⋯
            </summary>
            <div className={styles.bulkMenu}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => onClearBefore(date)}
                disabled={!canClearBefore}
              >
                {copy.details.clearBefore}
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => onClearAfter(date)}
                disabled={!canClearAfter}
              >
                {copy.details.clearAfter}
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={onClearAllUncompleted}
                disabled={!canClearAllUncompleted}
              >
                {copy.details.clearAllUncompleted}
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4>{copy.details.plannedSessions}</h4>
          <span className={styles.sectionCount}>
            {scheduledSessions.length}
          </span>
        </div>
        {scheduledSessions.length === 0 ? (
          <p className={styles.empty}>{copy.details.noPlannedSessions}</p>
        ) : (
          <ul className={styles.list}>
            {scheduledSessions.map((session) => {
              const planDay = dayById.get(session.planDayId);
              const isDone = session.status === "completed";
              const plannedWorkout = session.plannedWorkout;
              const plannedTypeLabel = plannedWorkout?.type
                ? typeById.has(plannedWorkout.type)
                  ? localizeWorkoutTypeName(
                      typeById.get(plannedWorkout.type)!,
                      language,
                    )
                  : plannedWorkout.type
                : undefined;
              const plannedWorkoutSummary = plannedWorkout
                ? [
                    plannedTypeLabel,
                    `${plannedWorkout.durationMin} min`,
                    plannedWorkout.targetWeightKg
                      ? `${copy.details.targetWeightLabel} ${plannedWorkout.targetWeightKg} kg`
                      : undefined,
                    plannedWorkout.distanceKm
                      ? `${plannedWorkout.distanceKm} km`
                      : undefined,
                    plannedWorkout.intensity
                      ? localizeIntensity(plannedWorkout.intensity, language)
                      : undefined,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(" · ")
                : undefined;

              return (
                <li key={session.id} className={styles.item}>
                  <div>
                    <strong>
                      {planDay?.label ?? copy.details.fallbackPlannedWorkout}
                    </strong>
                    <p>
                      {copy.details.status}:{" "}
                      {localizeSessionStatus(session.status, language)}
                    </p>
                    {plannedWorkoutSummary ? (
                      <p className={styles.planSummary}>
                        {plannedWorkoutSummary}
                      </p>
                    ) : null}
                    {plannedWorkout?.notes ? (
                      <p className={styles.notes}>{plannedWorkout.notes}</p>
                    ) : null}
                  </div>
                  {!isDone ? (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onPreviewSession(session.id)}
                      >
                        {copy.details.previewEdit}
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartWorkout(session.id)}
                      >
                        {session.status === "in_progress"
                          ? copy.details.resume
                          : copy.details.start}
                      </button>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onSkipSession(session.id)}
                      >
                        {copy.details.skip}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.actions}>
                      <span className={styles.badge}>
                        {copy.details.completed}
                      </span>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onResetSession(session.id)}
                      >
                        {copy.details.resetSession}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4>{copy.details.completedWorkouts}</h4>
          <span className={styles.sectionCount}>{workouts.length}</span>
        </div>
        {workouts.length === 0 ? (
          <p className={styles.empty}>{copy.details.noCompletedWorkouts}</p>
        ) : (
          <ul className={styles.list}>
            {workouts.map((workout) => {
              const type = typeById.get(workout.type);
              const estimatedCalories = estimateWorkoutCaloriesBurned(workout);
              const setWeights = workout.sessionSummary?.setLogs
                .map((setLog) => setLog.weightKg)
                .filter((value): value is number => typeof value === "number");
              const avgWeight =
                setWeights && setWeights.length > 0
                  ? Number(
                      (
                        setWeights.reduce((acc, value) => acc + value, 0) /
                        setWeights.length
                      ).toFixed(1),
                    )
                  : null;

              return (
                <li key={workout.id} className={styles.item}>
                  <div>
                    <strong>
                      {type
                        ? localizeWorkoutTypeName(type, language)
                        : workout.type}
                    </strong>
                    <p>
                      {workout.durationMin} min
                      {workout.targetWeightKg
                        ? ` · ${copy.details.targetWeightLabel} ${workout.targetWeightKg} kg`
                        : ""}
                      {workout.distanceKm ? ` · ${workout.distanceKm} km` : ""}
                      {` · ${copy.details.estimatedCalories(estimatedCalories)}`}
                      {avgWeight
                        ? ` · ${avgWeight} ${copy.details.avgPerSet}`
                        : ""}
                      {workout.intensity
                        ? ` · ${localizeIntensity(workout.intensity, language)}`
                        : ""}
                    </p>
                    {workout.notes ? (
                      <p className={styles.notes}>{workout.notes}</p>
                    ) : null}
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={() => onCopyWorkout(workout)}
                    >
                      {copy.details.copy}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyToNextWeek(workout)}
                    >
                      {copy.details.copyToNextWeek}
                    </button>
                    <button type="button" onClick={() => onEdit(workout)}>
                      {copy.details.edit}
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => onDelete(workout.id)}
                    >
                      {copy.details.delete}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
