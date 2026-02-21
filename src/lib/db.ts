import {
  createCollection,
  localStorageCollectionOptions,
  type Transaction,
} from '@tanstack/react-db'

import { addDays, isAfter, parseISO } from 'date-fns'

import { createId } from './ids'
import { nowIso } from './date'
import {
  activeSessionDraftSchema,
  exerciseTemplateSchema,
  planDaySchema,
  planTemplateSchema,
  scheduledSessionSchema,
  type ActiveSessionDraft,
  type ExerciseTemplate,
  type PlanDay,
  type PlanTemplate,
  type ScheduledSession,
  type ScheduledSessionStatus,
  type SessionExercisePlan,
  type SessionPlan,
  type SessionSummary,
  type Workout,
  type WorkoutIntensity,
  sessionPlanSchema,
  workoutSchema,
  workoutTypeSchema,
} from './types'
import { createStarterTemplateBundle, STARTER_TEMPLATE_ID } from './templates'

const DEFAULT_WORKOUT_TYPES = [
  { id: 'lift', name: 'Lift', color: '#ef476f' },
  { id: 'run', name: 'Run', color: '#118ab2' },
  { id: 'yoga', name: 'Yoga', color: '#06d6a0' },
  { id: 'mobility', name: 'Mobility', color: '#ffd166' },
  { id: 'cardio', name: 'Cardio', color: '#8d99ae' },
  { id: 'strength', name: 'Strength', color: '#f78c6b' },
] as const

export const workoutTypesCollection = createCollection(
  localStorageCollectionOptions({
    id: 'workout_types',
    storageKey: 'workout-tracker.workout-types.v1',
    schema: workoutTypeSchema,
    getKey: (item) => item.id,
  }),
)

export const workoutsCollection = createCollection(
  localStorageCollectionOptions({
    id: 'workouts',
    storageKey: 'workout-tracker.workouts.v1',
    schema: workoutSchema,
    getKey: (item) => item.id,
  }),
)

export const planTemplatesCollection = createCollection(
  localStorageCollectionOptions({
    id: 'plan_templates',
    storageKey: 'workout-tracker.plan-templates.v1',
    schema: planTemplateSchema,
    getKey: (item) => item.id,
  }),
)

export const planDaysCollection = createCollection(
  localStorageCollectionOptions({
    id: 'plan_days',
    storageKey: 'workout-tracker.plan-days.v1',
    schema: planDaySchema,
    getKey: (item) => item.id,
  }),
)

export const exerciseTemplatesCollection = createCollection(
  localStorageCollectionOptions({
    id: 'exercise_templates',
    storageKey: 'workout-tracker.exercise-templates.v1',
    schema: exerciseTemplateSchema,
    getKey: (item) => item.id,
  }),
)

export const scheduledSessionsCollection = createCollection(
  localStorageCollectionOptions({
    id: 'scheduled_sessions',
    storageKey: 'workout-tracker.scheduled-sessions.v1',
    schema: scheduledSessionSchema,
    getKey: (item) => item.id,
  }),
)

export const activeSessionDraftsCollection = createCollection(
  localStorageCollectionOptions({
    id: 'active_session_drafts',
    storageKey: 'workout-tracker.active-session-drafts.v1',
    schema: activeSessionDraftSchema,
    getKey: (item) => item.sessionId,
  }),
)

export const sessionPlansCollection = createCollection(
  localStorageCollectionOptions({
    id: 'session_plans',
    storageKey: 'workout-tracker.session-plans.v1',
    schema: sessionPlanSchema,
    getKey: (item) => item.id,
  }),
)

workoutsCollection.createIndex((row) => row.date, { name: 'workout_date_idx' })
workoutsCollection.createIndex((row) => row.type, { name: 'workout_type_idx' })
scheduledSessionsCollection.createIndex((row) => row.date, {
  name: 'scheduled_session_date_idx',
})
scheduledSessionsCollection.createIndex((row) => row.status, {
  name: 'scheduled_session_status_idx',
})
planDaysCollection.createIndex((row) => row.templateId, {
  name: 'plan_day_template_idx',
})
exerciseTemplatesCollection.createIndex((row) => row.planDayId, {
  name: 'exercise_template_plan_day_idx',
})

async function persist(tx: Transaction<Record<string, unknown>>): Promise<void> {
  await tx.isPersisted.promise
}

export async function ensureDefaultWorkoutTypes(): Promise<void> {
  const existingIds = new Set(workoutTypesCollection.toArray.map((item) => item.id))
  const missing = DEFAULT_WORKOUT_TYPES.filter((item) => !existingIds.has(item.id))

  if (missing.length === 0) {
    return
  }

  await persist(workoutTypesCollection.insert(missing))
}

export async function addWorkout(input: {
  date: string
  type: string
  durationMin: number
  targetWeightKg?: number
  distanceKm?: number
  intensity?: WorkoutIntensity
  notes?: string
  scheduledSessionId?: string
  sessionSummary?: SessionSummary
}): Promise<Workout> {
  const now = nowIso()
  const workout: Workout = {
    id: createId('workout'),
    createdAt: now,
    updatedAt: now,
    date: input.date,
    type: input.type,
    durationMin: input.durationMin,
    targetWeightKg: input.targetWeightKg,
    distanceKm: input.distanceKm,
    intensity: input.intensity,
    notes: input.notes,
    scheduledSessionId: input.scheduledSessionId,
    sessionSummary: input.sessionSummary,
  }

  await persist(workoutsCollection.insert(workout))
  return workout
}

export async function updateWorkout(
  id: string,
  input: {
    date: string
    type: string
    durationMin: number
    targetWeightKg?: number
    distanceKm?: number
    intensity?: WorkoutIntensity
    notes?: string
  },
): Promise<void> {
  await persist(
    workoutsCollection.update(id, (draft) => {
      draft.date = input.date
      draft.type = input.type
      draft.durationMin = input.durationMin
      draft.targetWeightKg = input.targetWeightKg
      draft.distanceKm = input.distanceKm
      draft.intensity = input.intensity
      draft.notes = input.notes
      draft.updatedAt = nowIso()
    }),
  )
}

export async function deleteWorkout(id: string): Promise<void> {
  const workout = workoutsCollection.get(id)
  await persist(workoutsCollection.delete(id))

  if (workout?.scheduledSessionId) {
    const linkedSession = scheduledSessionsCollection.get(workout.scheduledSessionId)
    if (linkedSession) {
      await persist(
        scheduledSessionsCollection.update(linkedSession.id, (draft) => {
          draft.status = 'planned'
          draft.workoutId = undefined
        }),
      )
    }
  }
}

export async function clearDataAfterDate(
  date: string,
): Promise<{ workoutsDeleted: number; sessionsDeleted: number }> {
  const workoutsAfterDate = workoutsCollection.toArray.filter((workout) => workout.date > date)
  const sessionsAfterDate = scheduledSessionsCollection.toArray.filter(
    (session) => session.date > date,
  )
  const sessionIdsToDelete = new Set(sessionsAfterDate.map((session) => session.id))

  for (const workout of workoutsAfterDate) {
    await deleteWorkout(workout.id)
  }

  for (const session of sessionsAfterDate) {
    if (!session.workoutId) {
      continue
    }

    const linkedWorkout = workoutsCollection.get(session.workoutId)
    if (!linkedWorkout) {
      continue
    }

    await persist(
      workoutsCollection.update(session.workoutId, (draft) => {
        draft.scheduledSessionId = undefined
        draft.updatedAt = nowIso()
      }),
    )
  }

  const draftIdsToDelete = activeSessionDraftsCollection.toArray
    .filter((draft) => sessionIdsToDelete.has(draft.sessionId))
    .map((draft) => draft.sessionId)
  const planIdsToDelete = sessionPlansCollection.toArray
    .filter((plan) => sessionIdsToDelete.has(plan.sessionId))
    .map((plan) => plan.id)
  const workoutsToDetach = workoutsCollection.toArray.filter(
    (workout) =>
      workout.scheduledSessionId !== undefined &&
      sessionIdsToDelete.has(workout.scheduledSessionId),
  )

  for (const workout of workoutsToDetach) {
    await persist(
      workoutsCollection.update(workout.id, (draft) => {
        draft.scheduledSessionId = undefined
        draft.updatedAt = nowIso()
      }),
    )
  }

  if (draftIdsToDelete.length > 0) {
    await persist(activeSessionDraftsCollection.delete(draftIdsToDelete))
  }

  if (planIdsToDelete.length > 0) {
    await persist(sessionPlansCollection.delete(planIdsToDelete))
  }

  const sessionIds = Array.from(sessionIdsToDelete)
  if (sessionIds.length > 0) {
    await persist(scheduledSessionsCollection.delete(sessionIds))
  }

  return {
    workoutsDeleted: workoutsAfterDate.length,
    sessionsDeleted: sessionsAfterDate.length,
  }
}

export async function importStarterTemplate(): Promise<void> {
  if (planTemplatesCollection.has(STARTER_TEMPLATE_ID)) {
    return
  }

  const bundle = createStarterTemplateBundle(nowIso())

  await Promise.all([
    persist(planTemplatesCollection.insert(bundle.template)),
    persist(planDaysCollection.insert(bundle.planDays)),
    persist(exerciseTemplatesCollection.insert(bundle.exercises)),
  ])
}

export type TemplateExerciseInput = {
  name: string
  sets: number
  minReps?: number
  maxReps?: number
  restSecDefault?: number
}

export type TemplateDayInput = {
  weekday: number
  label: string
  exercises: TemplateExerciseInput[]
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : undefined
}

function normalizeTemplateDays(days: TemplateDayInput[]): TemplateDayInput[] {
  return days
    .map((day) => {
      const weekday = Math.min(7, Math.max(1, Math.trunc(day.weekday)))
      const label = day.label.trim() || `Workout day ${weekday}`
      const exercises = day.exercises
        .map((exercise) => {
          const sets = normalizePositiveInteger(exercise.sets) ?? 1
          return {
            name: exercise.name.trim() || 'Exercise',
            sets,
            minReps: normalizePositiveInteger(exercise.minReps),
            maxReps: normalizePositiveInteger(exercise.maxReps),
            restSecDefault: normalizePositiveInteger(exercise.restSecDefault),
          }
        })
        .filter((exercise) => exercise.name.length > 0)

      return {
        weekday,
        label,
        exercises:
          exercises.length > 0
            ? exercises
            : [
                {
                  name: 'Exercise',
                  sets: 3,
                  minReps: undefined,
                  maxReps: undefined,
                  restSecDefault: 90,
                },
              ],
      }
    })
    .sort((a, b) => a.weekday - b.weekday)
}

export async function createPlanTemplate(input: {
  name: string
  startDate: string
  locale?: string
  days: TemplateDayInput[]
}): Promise<PlanTemplate> {
  const now = nowIso()
  const normalizedName = input.name.trim()
  if (!normalizedName) {
    throw new Error('Template name is required.')
  }

  const normalizedStartDate = input.startDate.trim()
  if (!normalizedStartDate) {
    throw new Error('Template start date is required.')
  }

  const normalizedDays = normalizeTemplateDays(input.days)
  if (normalizedDays.length === 0) {
    throw new Error('At least one plan day is required.')
  }

  const template: PlanTemplate = {
    id: createId('template'),
    name: normalizedName,
    startDate: normalizedStartDate,
    locale: input.locale ?? 'en',
    isStarter: false,
    createdAt: now,
    updatedAt: now,
  }

  const planDays: PlanDay[] = []
  const exercises: ExerciseTemplate[] = []

  for (const day of normalizedDays) {
    const planDayId = createId('plan_day')
    planDays.push({
      id: planDayId,
      templateId: template.id,
      weekday: day.weekday,
      label: day.label,
    })

    for (const exercise of day.exercises) {
      exercises.push({
        id: createId('exercise'),
        planDayId,
        name: exercise.name,
        sets: exercise.sets,
        minReps: exercise.minReps,
        maxReps: exercise.maxReps,
        restSecDefault: exercise.restSecDefault,
      })
    }
  }

  await Promise.all([
    persist(planTemplatesCollection.insert(template)),
    persist(planDaysCollection.insert(planDays)),
    persist(exerciseTemplatesCollection.insert(exercises)),
  ])

  return template
}

function scheduledSessionId(templateId: string, planDayId: string, date: string): string {
  return `${templateId}_${planDayId}_${date}`
}

export async function generateScheduleForRange(input: {
  templateId: string
  from: string
  to: string
}): Promise<number> {
  const { templateId, from, to } = input
  const template = planTemplatesCollection.get(templateId)
  if (!template) {
    return 0
  }

  const scheduleFrom = template.startDate > from ? template.startDate : from
  if (scheduleFrom > to) {
    return 0
  }

  const templateDays = planDaysCollection.toArray.filter(
    (day) => day.templateId === templateId,
  )

  if (templateDays.length === 0) {
    return 0
  }

  const recordsToInsert: ScheduledSession[] = []
  let cursor = parseISO(scheduleFrom)
  const end = parseISO(to)

  while (!isAfter(cursor, end)) {
    const isoDate = cursor.toISOString().slice(0, 10)
    const isoWeekday = ((cursor.getDay() + 6) % 7) + 1

    for (const day of templateDays) {
      if (day.weekday !== isoWeekday) {
        continue
      }

      const id = scheduledSessionId(templateId, day.id, isoDate)
      if (scheduledSessionsCollection.has(id)) {
        continue
      }

      recordsToInsert.push({
        id,
        templateId,
        planDayId: day.id,
        date: isoDate,
        status: 'planned',
      })
    }

    cursor = addDays(cursor, 1)
  }

  if (recordsToInsert.length > 0) {
    await persist(scheduledSessionsCollection.insert(recordsToInsert))
  }

  return recordsToInsert.length
}

export async function updateScheduledSessionStatus(
  sessionId: string,
  status: ScheduledSessionStatus,
  workoutId?: string,
): Promise<void> {
  await persist(
    scheduledSessionsCollection.update(sessionId, (draft) => {
      draft.status = status
      draft.workoutId = workoutId
    }),
  )
}

export async function beginGuidedSession(sessionId: string): Promise<void> {
  const session = scheduledSessionsCollection.get(sessionId)
  if (!session) {
    throw new Error('Scheduled session not found.')
  }

  const existingDraft = activeSessionDraftsCollection.get(sessionId)
  if (!existingDraft) {
    const draft: ActiveSessionDraft = {
      sessionId,
      startedAt: nowIso(),
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      setLogs: [],
      timerPaused: true,
      updatedAt: nowIso(),
    }

    await persist(activeSessionDraftsCollection.insert(draft))
  }

  if (session.status === 'planned') {
    await updateScheduledSessionStatus(sessionId, 'in_progress')
  }
}

export async function saveGuidedSessionDraft(
  sessionId: string,
  updater: (draft: ActiveSessionDraft) => ActiveSessionDraft,
): Promise<void> {
  const current = activeSessionDraftsCollection.get(sessionId)
  if (!current) {
    return
  }

  const next = updater(current)
  await persist(
    activeSessionDraftsCollection.update(sessionId, (draft) => {
      draft.currentExerciseIndex = next.currentExerciseIndex
      draft.currentSetIndex = next.currentSetIndex
      draft.setLogs = next.setLogs
      draft.restEndAt = next.restEndAt
      draft.timerPaused = next.timerPaused
      draft.timerRemainingSec = next.timerRemainingSec
      draft.updatedAt = nowIso()
    }),
  )
}

function inferWorkoutTypeFromPlanDay(day: PlanDay | undefined): string {
  if (!day) {
    return 'lift'
  }

  const label = day.label.toLowerCase()
  if (label.includes('yoga')) {
    return 'yoga'
  }
  if (label.includes('run')) {
    return 'run'
  }
  if (label.includes('cardio')) {
    return 'cardio'
  }
  if (label.includes('mobility')) {
    return 'mobility'
  }
  return 'lift'
}

function estimateDurationFromSetLogs(
  exercises: Array<Pick<ExerciseTemplate, 'sets' | 'restSecDefault'>>,
  summary: SessionSummary,
): number {
  const totalSets = summary.setLogs.length
  const defaultDuration = Math.max(20, totalSets * 3)
  const explicit = summary.totalDurationMin

  if (explicit > 0) {
    return Math.round(explicit)
  }

  const estimatedFromTemplate = exercises.reduce((acc, exercise) => {
    const restEstimate = Math.ceil((exercise.restSecDefault ?? 75) / 60)
    return acc + exercise.sets * restEstimate
  }, 0)

  return Math.max(defaultDuration, estimatedFromTemplate)
}

export async function completeGuidedSession(input: {
  sessionId: string
  summary: SessionSummary
  notes?: string
}): Promise<Workout> {
  const session = scheduledSessionsCollection.get(input.sessionId)
  if (!session) {
    throw new Error('Scheduled session not found')
  }

  const planDay = planDaysCollection.get(session.planDayId)
  const sessionPlan = sessionPlansCollection.get(session.id)
  const exercises = sessionPlan
    ? sessionPlan.exercises
    : exerciseTemplatesCollection.toArray.filter(
        (item) => item.planDayId === session.planDayId,
      )

  const workout = await addWorkout({
    date: session.date,
    type: inferWorkoutTypeFromPlanDay(planDay),
    durationMin: estimateDurationFromSetLogs(exercises, input.summary),
    notes: input.notes ?? sessionPlan?.notes,
    scheduledSessionId: session.id,
    sessionSummary: input.summary,
  })

  await updateScheduledSessionStatus(session.id, 'completed', workout.id)
  if (activeSessionDraftsCollection.has(session.id)) {
    await persist(activeSessionDraftsCollection.delete(session.id))
  }

  return workout
}

export async function skipScheduledSession(sessionId: string): Promise<void> {
  await updateScheduledSessionStatus(sessionId, 'skipped')
  if (activeSessionDraftsCollection.has(sessionId)) {
    await persist(activeSessionDraftsCollection.delete(sessionId))
  }
}

export async function moveScheduledSessionToDate(
  sessionId: string,
  nextDate: string,
): Promise<string> {
  const session = scheduledSessionsCollection.get(sessionId)
  if (!session) {
    throw new Error('Scheduled session not found.')
  }

  if (session.date === nextDate) {
    return sessionId
  }

  const nextSessionId = scheduledSessionId(
    session.templateId,
    session.planDayId,
    nextDate,
  )

  if (scheduledSessionsCollection.has(nextSessionId)) {
    throw new Error('A session already exists for that day.')
  }

  const movedSession: ScheduledSession = {
    ...session,
    id: nextSessionId,
    date: nextDate,
    status: 'planned',
    workoutId: undefined,
  }

  await persist(scheduledSessionsCollection.insert(movedSession))
  await persist(scheduledSessionsCollection.delete(sessionId))

  if (activeSessionDraftsCollection.has(sessionId)) {
    await persist(activeSessionDraftsCollection.delete(sessionId))
  }

  const existingPlan = sessionPlansCollection.get(sessionId)
  if (existingPlan) {
    const movedPlan: SessionPlan = {
      ...existingPlan,
      id: nextSessionId,
      sessionId: nextSessionId,
      updatedAt: nowIso(),
    }

    await persist(sessionPlansCollection.insert(movedPlan))
    await persist(sessionPlansCollection.delete(sessionId))
  }

  return nextSessionId
}

export async function resetCompletedSession(sessionId: string): Promise<void> {
  const session = scheduledSessionsCollection.get(sessionId)
  if (!session) {
    return
  }

  if (session.workoutId && workoutsCollection.has(session.workoutId)) {
    await deleteWorkout(session.workoutId)
    return
  }

  await persist(
    scheduledSessionsCollection.update(sessionId, (draft) => {
      draft.status = 'planned'
      draft.workoutId = undefined
    }),
  )
}

function toSessionExercisePlan(exercise: ExerciseTemplate): SessionExercisePlan {
  return {
    id: exercise.id,
    name: exercise.name,
    sets: exercise.sets,
    minReps: exercise.minReps,
    maxReps: exercise.maxReps,
    restSecDefault: exercise.restSecDefault,
  }
}

export async function getOrCreateSessionPlan(sessionId: string): Promise<SessionPlan> {
  const existing = sessionPlansCollection.get(sessionId)
  if (existing) {
    return existing
  }

  const session = scheduledSessionsCollection.get(sessionId)
  if (!session) {
    throw new Error('Scheduled session not found.')
  }

  const planDay = planDaysCollection.get(session.planDayId)
  const exercises = exerciseTemplatesCollection.toArray
    .filter((item) => item.planDayId === session.planDayId)
    .map(toSessionExercisePlan)

  const sessionPlan: SessionPlan = {
    id: sessionId,
    sessionId,
    title: planDay?.label ?? 'Planned workout',
    notes: undefined,
    exercises,
    updatedAt: nowIso(),
  }

  await persist(sessionPlansCollection.insert(sessionPlan))
  return sessionPlan
}

export async function updateSessionPlan(
  sessionId: string,
  updater: (plan: SessionPlan) => SessionPlan,
): Promise<void> {
  const existing = await getOrCreateSessionPlan(sessionId)
  const next = updater(existing)

  await persist(
    sessionPlansCollection.update(sessionId, (draft) => {
      draft.title = next.title
      draft.notes = next.notes
      draft.exercises = next.exercises
      draft.updatedAt = nowIso()
    }),
  )
}
