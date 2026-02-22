import {
  createCollection,
  localStorageCollectionOptions,
  type Transaction,
} from '@tanstack/react-db'

import { addDays, isAfter, isBefore, isValid, parseISO } from 'date-fns'

import { createId } from './ids'
import { nowIso, toDateIso } from './date'
import {
  activeSessionDraftSchema,
  exerciseCatalogEntrySchema,
  exerciseTemplateSchema,
  planDaySchema,
  planTemplateSchema,
  scheduledSessionSchema,
  type ActiveSessionDraft,
  type ExerciseTemplate,
  type ExerciseCatalogEntry,
  type PlanDay,
  type PlanTemplate,
  type ScheduledSession,
  type ScheduledSessionStatus,
  type SessionExercisePlan,
  type SessionPlan,
  type SessionSummary,
  type PlannedWorkout,
  type Workout,
  type WorkoutIntensity,
  type WorkoutType,
  sessionPlanSchema,
  workoutSchema,
  workoutTypeSchema,
} from './types'
import { createStarterTemplateBundle, STARTER_TEMPLATE_ID } from './templates'
import { inferWorkoutTypeFromPlanDay } from './workoutType'
import { getAllExerciseNames } from './exerciseDb'

const DEFAULT_WORKOUT_TYPES = [
  { id: 'lift', name: 'Lift', color: '#ef476f' },
  { id: 'run', name: 'Run', color: '#118ab2' },
  { id: 'yoga', name: 'Yoga', color: '#06d6a0' },
  { id: 'mobility', name: 'Mobility', color: '#ffd166' },
  { id: 'cardio', name: 'Cardio', color: '#8d99ae' },
  { id: 'strength', name: 'Strength', color: '#f78c6b' },
] as const

export const MANUAL_TEMPLATE_ID = 'manual_plan_template'
export const MANUAL_PLAN_DAY_ID = 'manual_plan_day'
const MANUAL_PLAN_DAY_LABEL = 'Planned workout'
export const MIN_TEMPLATE_COUNT = 1
export const LAST_TEMPLATE_DELETE_ERROR = 'At least one template is required.'

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

export const exerciseCatalogCollection = createCollection(
  localStorageCollectionOptions({
    id: 'exercise_catalog',
    storageKey: 'workout-tracker.exercise-catalog.v1',
    schema: exerciseCatalogEntrySchema,
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
exerciseCatalogCollection.createIndex((row) => row.name, {
  name: 'exercise_catalog_name_idx',
})

async function persist(tx: Transaction<Record<string, unknown>>): Promise<void> {
  await tx.isPersisted.promise
}

const WORKOUT_DATA_SNAPSHOT_SCHEMA_VERSION = 1

type PersistedCollection<T extends { id: string }> = {
  toArray: T[]
  preload: () => Promise<void>
  delete: (keys: string[]) => Transaction<Record<string, unknown>>
  insert: (value: T | T[]) => Transaction<Record<string, unknown>>
}

type SnapshotShape = {
  schemaVersion: number
  exportedAt: string
  workoutTypes: WorkoutType[]
  workouts: Workout[]
  planTemplates: PlanTemplate[]
  planDays: PlanDay[]
  exerciseTemplates: ExerciseTemplate[]
  exerciseCatalog: ExerciseCatalogEntry[]
  scheduledSessions: ScheduledSession[]
  activeSessionDrafts: ActiveSessionDraft[]
  sessionPlans: SessionPlan[]
}

export type WorkoutDataSnapshot = SnapshotShape

type SafeParser<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false }
}

function parseSnapshotArray<T>(value: unknown, parser: SafeParser<T>): T[] {
  if (!Array.isArray(value)) {
    return []
  }

  const parsed: T[] = []
  for (const item of value) {
    const result = parser.safeParse(item)
    if (result.success) {
      parsed.push(result.data)
    }
  }

  return parsed
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id))
}

function sortBySessionId<T extends { sessionId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sessionId.localeCompare(b.sessionId))
}

function normalizeWorkoutDataSnapshot(input: Partial<WorkoutDataSnapshot>): WorkoutDataSnapshot {
  return {
    schemaVersion:
      typeof input.schemaVersion === 'number'
        ? input.schemaVersion
        : WORKOUT_DATA_SNAPSHOT_SCHEMA_VERSION,
    exportedAt:
      typeof input.exportedAt === 'string' && input.exportedAt.length > 0
        ? input.exportedAt
        : nowIso(),
    workoutTypes: sortById(parseSnapshotArray(input.workoutTypes, workoutTypeSchema)),
    workouts: sortById(parseSnapshotArray(input.workouts, workoutSchema)),
    planTemplates: sortById(parseSnapshotArray(input.planTemplates, planTemplateSchema)),
    planDays: sortById(parseSnapshotArray(input.planDays, planDaySchema)),
    exerciseTemplates: sortById(
      parseSnapshotArray(input.exerciseTemplates, exerciseTemplateSchema),
    ),
    exerciseCatalog: sortById(
      parseSnapshotArray(input.exerciseCatalog, exerciseCatalogEntrySchema),
    ),
    scheduledSessions: sortById(
      parseSnapshotArray(input.scheduledSessions, scheduledSessionSchema),
    ),
    activeSessionDrafts: sortBySessionId(
      parseSnapshotArray(input.activeSessionDrafts, activeSessionDraftSchema),
    ),
    sessionPlans: sortById(parseSnapshotArray(input.sessionPlans, sessionPlanSchema)),
  }
}

export function exportWorkoutDataSnapshot(): WorkoutDataSnapshot {
  return normalizeWorkoutDataSnapshot({
    schemaVersion: WORKOUT_DATA_SNAPSHOT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    workoutTypes: workoutTypesCollection.toArray,
    workouts: workoutsCollection.toArray,
    planTemplates: planTemplatesCollection.toArray,
    planDays: planDaysCollection.toArray,
    exerciseTemplates: exerciseTemplatesCollection.toArray,
    exerciseCatalog: exerciseCatalogCollection.toArray,
    scheduledSessions: scheduledSessionsCollection.toArray,
    activeSessionDrafts: activeSessionDraftsCollection.toArray,
    sessionPlans: sessionPlansCollection.toArray,
  })
}

export function serializeWorkoutDataSnapshot(snapshot: WorkoutDataSnapshot): string {
  const normalized = normalizeWorkoutDataSnapshot(snapshot)
  return JSON.stringify(normalized)
}

async function clearCollectionById<T extends { id: string }>(
  collection: PersistedCollection<T>,
): Promise<void> {
  await collection.preload()
  const ids = collection.toArray.map((entry) => entry.id)
  if (ids.length === 0) {
    return
  }

  await persist(collection.delete(ids))
}

async function clearSessionDraftCollection(): Promise<void> {
  await activeSessionDraftsCollection.preload()
  const keys = activeSessionDraftsCollection.toArray.map((entry) => entry.sessionId)
  if (keys.length === 0) {
    return
  }

  await persist(activeSessionDraftsCollection.delete(keys))
}

export async function replaceWorkoutDataSnapshot(
  snapshot: Partial<WorkoutDataSnapshot>,
): Promise<WorkoutDataSnapshot> {
  const normalized = normalizeWorkoutDataSnapshot(snapshot)

  await Promise.all([
    workoutTypesCollection.preload(),
    workoutsCollection.preload(),
    planTemplatesCollection.preload(),
    planDaysCollection.preload(),
    exerciseTemplatesCollection.preload(),
    exerciseCatalogCollection.preload(),
    scheduledSessionsCollection.preload(),
    activeSessionDraftsCollection.preload(),
    sessionPlansCollection.preload(),
  ])

  await clearSessionDraftCollection()
  await clearCollectionById(sessionPlansCollection)
  await clearCollectionById(scheduledSessionsCollection)
  await clearCollectionById(workoutsCollection)
  await clearCollectionById(exerciseTemplatesCollection)
  await clearCollectionById(planDaysCollection)
  await clearCollectionById(planTemplatesCollection)
  await clearCollectionById(exerciseCatalogCollection)
  await clearCollectionById(workoutTypesCollection)

  if (normalized.workoutTypes.length > 0) {
    await persist(workoutTypesCollection.insert(normalized.workoutTypes))
  }
  if (normalized.workouts.length > 0) {
    await persist(workoutsCollection.insert(normalized.workouts))
  }
  if (normalized.planTemplates.length > 0) {
    await persist(planTemplatesCollection.insert(normalized.planTemplates))
  }
  if (normalized.planDays.length > 0) {
    await persist(planDaysCollection.insert(normalized.planDays))
  }
  if (normalized.exerciseTemplates.length > 0) {
    await persist(exerciseTemplatesCollection.insert(normalized.exerciseTemplates))
  }
  if (normalized.exerciseCatalog.length > 0) {
    await persist(exerciseCatalogCollection.insert(normalized.exerciseCatalog))
  }
  if (normalized.scheduledSessions.length > 0) {
    await persist(scheduledSessionsCollection.insert(normalized.scheduledSessions))
  }
  if (normalized.activeSessionDrafts.length > 0) {
    await persist(activeSessionDraftsCollection.insert(normalized.activeSessionDrafts))
  }
  if (normalized.sessionPlans.length > 0) {
    await persist(sessionPlansCollection.insert(normalized.sessionPlans))
  }

  return normalized
}

export async function ensureDefaultWorkoutTypes(): Promise<void> {
  const existingIds = new Set(workoutTypesCollection.toArray.map((item) => item.id))
  const missing = DEFAULT_WORKOUT_TYPES.filter((item) => !existingIds.has(item.id))

  if (missing.length === 0) {
    return
  }

  await persist(workoutTypesCollection.insert(missing))
}

export async function ensureDefaultExerciseCatalog(): Promise<void> {
  const existingNames = new Set(
    exerciseCatalogCollection.toArray.map((entry) => entry.name.trim().toLowerCase()),
  )
  const catalogNames = await getAllExerciseNames()
  const missing = catalogNames.filter(
    (name) => !existingNames.has(name.trim().toLowerCase()),
  )

  if (missing.length === 0) {
    return
  }

  const now = nowIso()
  const entries: ExerciseCatalogEntry[] = missing.map((name) => ({
    id: createId('exercise'),
    name,
    createdAt: now,
    updatedAt: now,
  }))

  await persist(exerciseCatalogCollection.insert(entries))
}

export async function addExerciseCatalogEntry(name: string): Promise<ExerciseCatalogEntry | null> {
  const trimmed = name.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.toLowerCase()
  const existing = exerciseCatalogCollection.toArray.find(
    (entry) => entry.name.trim().toLowerCase() === normalized,
  )
  if (existing) {
    return existing
  }

  const now = nowIso()
  const entry: ExerciseCatalogEntry = {
    id: createId('exercise'),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  }
  await persist(exerciseCatalogCollection.insert(entry))
  return entry
}

async function ensureManualPlanDay(): Promise<void> {
  if (planDaysCollection.has(MANUAL_PLAN_DAY_ID)) {
    return
  }

  await persist(
    planDaysCollection.insert({
      id: MANUAL_PLAN_DAY_ID,
      templateId: MANUAL_TEMPLATE_ID,
      weekday: 1,
      label: MANUAL_PLAN_DAY_LABEL,
    }),
  )
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

type DeleteWorkoutOptions = {
  preserveScheduledSession?: boolean
}

export async function deleteWorkout(
  id: string,
  options: DeleteWorkoutOptions = {},
): Promise<void> {
  const workout = workoutsCollection.get(id)
  await persist(workoutsCollection.delete(id))

  if (workout?.scheduledSessionId) {
    const linkedSessionId = workout.scheduledSessionId
    const linkedSession = scheduledSessionsCollection.get(linkedSessionId)
    if (linkedSession) {
      if (options.preserveScheduledSession) {
        await persist(
          scheduledSessionsCollection.update(linkedSession.id, (draft) => {
            draft.status = 'planned'
            draft.workoutId = undefined
          }),
        )
        return
      }

      const draftIdsToDelete = activeSessionDraftsCollection.toArray
        .filter((draft) => draft.sessionId === linkedSessionId)
        .map((draft) => draft.sessionId)
      const planIdsToDelete = sessionPlansCollection.toArray
        .filter((plan) => plan.sessionId === linkedSessionId)
        .map((plan) => plan.id)
      const workoutsToDetach = workoutsCollection.toArray.filter(
        (record) => record.scheduledSessionId === linkedSessionId,
      )

      for (const detachedWorkout of workoutsToDetach) {
        await persist(
          workoutsCollection.update(detachedWorkout.id, (draft) => {
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

      await persist(
        scheduledSessionsCollection.delete([linkedSession.id]),
      )
    }
  }
}

type ClearDataDirection = 'after' | 'before'

async function clearDataByDate(
  date: string,
  direction: ClearDataDirection,
): Promise<{ workoutsDeleted: number; sessionsDeleted: number }> {
  const parsedCutoffDate = parseISO(date)
  const hasValidCutoffDate = isValid(parsedCutoffDate)
  const isTargetDate = (value: string) => {
    if (hasValidCutoffDate) {
      const parsedValue = parseISO(value)
      if (isValid(parsedValue)) {
        return direction === 'after'
          ? isAfter(parsedValue, parsedCutoffDate)
          : isBefore(parsedValue, parsedCutoffDate)
      }
    }

    return direction === 'after' ? value > date : value < date
  }

  const sessionsToDelete = scheduledSessionsCollection.toArray.filter(
    (session) => isTargetDate(session.date) && session.status !== 'completed',
  )
  const sessionIdsToDelete = new Set(sessionsToDelete.map((session) => session.id))
  const workoutIdsToDelete = Array.from(
    new Set(
      sessionsToDelete
        .map((session) => session.workoutId)
        .filter((workoutId): workoutId is string => Boolean(workoutId)),
    ),
  ).filter((workoutId) => workoutsCollection.has(workoutId))
  const workoutIdsToDeleteSet = new Set(workoutIdsToDelete)

  if (workoutIdsToDelete.length > 0) {
    await persist(workoutsCollection.delete(workoutIdsToDelete))
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
      sessionIdsToDelete.has(workout.scheduledSessionId) &&
      !workoutIdsToDeleteSet.has(workout.id),
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

  if (direction === 'after') {
    const templatesToClamp = planTemplatesCollection.toArray.filter(
      (template) => template.endDate === undefined || template.endDate > date,
    )
    for (const template of templatesToClamp) {
      await persist(
        planTemplatesCollection.update(template.id, (draft) => {
          draft.endDate = date
          draft.updatedAt = nowIso()
        }),
      )
    }
  } else {
    const templatesToShift = planTemplatesCollection.toArray.filter(
      (template) => template.startDate < date,
    )
    for (const template of templatesToShift) {
      await persist(
        planTemplatesCollection.update(template.id, (draft) => {
          draft.startDate = date
          draft.updatedAt = nowIso()
        }),
      )
    }
  }

  return {
    workoutsDeleted: workoutIdsToDelete.length,
    sessionsDeleted: sessionsToDelete.length,
  }
}

export async function clearDataAfterDate(
  date: string,
): Promise<{ workoutsDeleted: number; sessionsDeleted: number }> {
  return clearDataByDate(date, 'after')
}

export async function clearDataBeforeDate(
  date: string,
): Promise<{ workoutsDeleted: number; sessionsDeleted: number }> {
  return clearDataByDate(date, 'before')
}

export async function clearAllUncompletedSessions(): Promise<{ sessionsDeleted: number }> {
  const sessionsToDelete = scheduledSessionsCollection.toArray.filter(
    (session) => session.status !== 'completed',
  )
  const sessionIdsToDelete = new Set(sessionsToDelete.map((session) => session.id))

  if (sessionIdsToDelete.size === 0) {
    return { sessionsDeleted: 0 }
  }

  for (const session of sessionsToDelete) {
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

  await persist(scheduledSessionsCollection.delete(Array.from(sessionIdsToDelete)))

  return { sessionsDeleted: sessionsToDelete.length }
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

async function deleteTemplateSessions(templateId: string): Promise<number> {
  const sessionsToDelete = scheduledSessionsCollection.toArray.filter(
    (session) => session.templateId === templateId,
  )
  const sessionIdsToDelete = new Set(sessionsToDelete.map((session) => session.id))

  if (sessionIdsToDelete.size === 0) {
    return 0
  }

  for (const session of sessionsToDelete) {
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

  await persist(scheduledSessionsCollection.delete(Array.from(sessionIdsToDelete)))

  return sessionsToDelete.length
}

export async function updatePlanTemplate(input: {
  templateId: string
  name: string
  startDate: string
  locale?: string
  days: TemplateDayInput[]
}): Promise<void> {
  const now = nowIso()
  const template = planTemplatesCollection.get(input.templateId)
  if (!template) {
    throw new Error('Template not found.')
  }

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

  await deleteTemplateSessions(template.id)

  const existingPlanDayIds = planDaysCollection.toArray
    .filter((day) => day.templateId === template.id)
    .map((day) => day.id)
  const existingExerciseIds = exerciseTemplatesCollection.toArray
    .filter((exercise) => existingPlanDayIds.includes(exercise.planDayId))
    .map((exercise) => exercise.id)

  if (existingExerciseIds.length > 0) {
    await persist(exerciseTemplatesCollection.delete(existingExerciseIds))
  }
  if (existingPlanDayIds.length > 0) {
    await persist(planDaysCollection.delete(existingPlanDayIds))
  }

  await persist(
    planTemplatesCollection.update(template.id, (draft) => {
      draft.name = normalizedName
      draft.startDate = normalizedStartDate
      draft.locale = input.locale ?? draft.locale
      draft.updatedAt = now
    }),
  )

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
    persist(planDaysCollection.insert(planDays)),
    persist(exerciseTemplatesCollection.insert(exercises)),
  ])
}

export async function deletePlanTemplate(templateId: string): Promise<void> {
  const template = planTemplatesCollection.get(templateId)
  if (!template) {
    return
  }

  if (planTemplatesCollection.toArray.length <= MIN_TEMPLATE_COUNT) {
    throw new Error(LAST_TEMPLATE_DELETE_ERROR)
  }

  await deleteTemplateSessions(template.id)

  const planDayIds = planDaysCollection.toArray
    .filter((day) => day.templateId === template.id)
    .map((day) => day.id)
  const exerciseIds = exerciseTemplatesCollection.toArray
    .filter((exercise) => planDayIds.includes(exercise.planDayId))
    .map((exercise) => exercise.id)

  if (exerciseIds.length > 0) {
    await persist(exerciseTemplatesCollection.delete(exerciseIds))
  }
  if (planDayIds.length > 0) {
    await persist(planDaysCollection.delete(planDayIds))
  }

  await persist(planTemplatesCollection.delete(template.id))
}

function scheduledSessionId(templateId: string, planDayId: string, date: string): string {
  return `${templateId}_${planDayId}_${date}`
}

export async function applyTemplateToCalendar(input: {
  templateId: string
  startDate: string
  to: string
  startPlanDayId?: string
}): Promise<{ inserted: number; removed: number }> {
  const template = planTemplatesCollection.get(input.templateId)
  if (!template) {
    return { inserted: 0, removed: 0 }
  }

  const normalizedStartDate = input.startDate.trim()
  if (!normalizedStartDate) {
    throw new Error('Template start date is required.')
  }

  const templateDays = planDaysCollection.toArray.filter(
    (day) => day.templateId === input.templateId,
  )
  if (templateDays.length === 0) {
    return { inserted: 0, removed: 0 }
  }

  if (input.startPlanDayId) {
    const startPlanDay = templateDays.find((day) => day.id === input.startPlanDayId)
    if (!startPlanDay) {
      throw new Error('Template day to start from was not found.')
    }

    const startDateWeekday = ((parseISO(normalizedStartDate).getDay() + 6) % 7) + 1
    const weekdayOffset = startDateWeekday - startPlanDay.weekday

    if (weekdayOffset !== 0) {
      for (const day of templateDays) {
        const shiftedWeekday = ((day.weekday - 1 + weekdayOffset + 7) % 7) + 1
        await persist(
          planDaysCollection.update(day.id, (draft) => {
            draft.weekday = shiftedWeekday
          }),
        )
      }
    }
  }

  const sessionsToRemove = scheduledSessionsCollection.toArray.filter(
    (session) => session.templateId === input.templateId && !session.workoutId,
  )
  const sessionIdsToRemove = sessionsToRemove.map((session) => session.id)
  const sessionIdSet = new Set(sessionIdsToRemove)

  if (sessionIdsToRemove.length > 0) {
    const draftIdsToDelete = activeSessionDraftsCollection.toArray
      .filter((draft) => sessionIdSet.has(draft.sessionId))
      .map((draft) => draft.sessionId)
    const planIdsToDelete = sessionPlansCollection.toArray
      .filter((plan) => sessionIdSet.has(plan.sessionId))
      .map((plan) => plan.id)

    if (draftIdsToDelete.length > 0) {
      await persist(activeSessionDraftsCollection.delete(draftIdsToDelete))
    }

    if (planIdsToDelete.length > 0) {
      await persist(sessionPlansCollection.delete(planIdsToDelete))
    }

    await persist(scheduledSessionsCollection.delete(sessionIdsToRemove))
  }

  await persist(
    planTemplatesCollection.update(input.templateId, (draft) => {
      draft.startDate = normalizedStartDate
      draft.endDate = undefined
      draft.updatedAt = nowIso()
    }),
  )

  const inserted = await generateScheduleForRange({
    templateId: input.templateId,
    from: normalizedStartDate,
    to: input.to,
  })

  return { inserted, removed: sessionIdsToRemove.length }
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
  const scheduleTo =
    template.endDate && template.endDate < to ? template.endDate : to
  if (scheduleFrom > scheduleTo) {
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
  const end = parseISO(scheduleTo)

  while (!isAfter(cursor, end)) {
    const isoDate = toDateIso(cursor)
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

export async function planManualWorkout(input: {
  date: string
} & PlannedWorkout): Promise<ScheduledSession> {
  const normalizedDate = input.date.trim()
  if (!normalizedDate) {
    throw new Error('Date is required.')
  }

  await ensureManualPlanDay()

  const id = scheduledSessionId(MANUAL_TEMPLATE_ID, MANUAL_PLAN_DAY_ID, normalizedDate)
  if (scheduledSessionsCollection.has(id)) {
    throw new Error('A planned workout already exists for that day.')
  }

  const session: ScheduledSession = {
    id,
    templateId: MANUAL_TEMPLATE_ID,
    planDayId: MANUAL_PLAN_DAY_ID,
    date: normalizedDate,
    status: 'planned',
    plannedWorkout: {
      type: input.type,
      durationMin: input.durationMin,
      targetWeightKg: input.targetWeightKg,
      distanceKm: input.distanceKm,
      intensity: input.intensity,
      notes: input.notes,
    },
  }

  await persist(scheduledSessionsCollection.insert(session))
  return session
}

export async function duplicateScheduledSession(
  sessionId: string,
  date: string,
): Promise<ScheduledSession> {
  const nextDate = date.trim()
  if (!nextDate) {
    throw new Error('Date is required.')
  }

  const session = scheduledSessionsCollection.get(sessionId)
  if (!session) {
    throw new Error('Scheduled session not found.')
  }

  const nextId = scheduledSessionId(session.templateId, session.planDayId, nextDate)
  if (scheduledSessionsCollection.has(nextId)) {
    throw new Error('A session already exists for that day.')
  }

  const duplicated: ScheduledSession = {
    ...session,
    id: nextId,
    date: nextDate,
    status: 'planned',
    workoutId: undefined,
  }

  await persist(scheduledSessionsCollection.insert(duplicated))

  const existingPlan = sessionPlansCollection.get(sessionId)
  if (existingPlan) {
    const duplicatedPlan: SessionPlan = {
      ...existingPlan,
      id: nextId,
      sessionId: nextId,
      updatedAt: nowIso(),
    }

    await persist(sessionPlansCollection.insert(duplicatedPlan))
  }

  return duplicated
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
  const plannedWorkout = session.plannedWorkout

  const workout = await addWorkout({
    date: session.date,
    type: plannedWorkout?.type ?? inferWorkoutTypeFromPlanDay(planDay),
    durationMin:
      plannedWorkout?.durationMin ?? estimateDurationFromSetLogs(exercises, input.summary),
    targetWeightKg: plannedWorkout?.targetWeightKg,
    distanceKm: plannedWorkout?.distanceKm,
    intensity: plannedWorkout?.intensity,
    notes: input.notes ?? plannedWorkout?.notes ?? sessionPlan?.notes,
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
    await deleteWorkout(session.workoutId, { preserveScheduledSession: true })
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
    targetMassKg: exercise.targetMassKg,
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
