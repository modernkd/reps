import { beforeEach, describe, expect, it } from 'vitest'

import {
  activeSessionDraftsCollection,
  addWorkout,
  clearDataAfterDate,
  exerciseTemplatesCollection,
  generateScheduleForRange,
  importStarterTemplate,
  moveScheduledSessionToDate,
  planDaysCollection,
  planTemplatesCollection,
  scheduledSessionsCollection,
  sessionPlansCollection,
  updateWorkout,
  workoutsCollection,
} from './db'

async function clearCollection<T extends { id: string }>(collection: {
  toArray: T[]
  delete: (keys: string[]) => { isPersisted: { promise: Promise<unknown> } }
  preload: () => Promise<void>
}) {
  await collection.preload()
  const keys = collection.toArray.map((item) => item.id)
  if (keys.length === 0) {
    return
  }

  const tx = collection.delete(keys)
  await tx.isPersisted.promise
}

async function clearSessionDraftCollection() {
  await activeSessionDraftsCollection.preload()
  const keys = activeSessionDraftsCollection.toArray.map((item) => item.sessionId)
  if (keys.length === 0) {
    return
  }

  const tx = activeSessionDraftsCollection.delete(keys)
  await tx.isPersisted.promise
}

beforeEach(async () => {
  window.localStorage.clear()

  await clearSessionDraftCollection()
  await clearCollection(scheduledSessionsCollection)
  await clearCollection(sessionPlansCollection)
  await clearCollection(workoutsCollection)
  await clearCollection(exerciseTemplatesCollection)
  await clearCollection(planDaysCollection)
  await clearCollection(planTemplatesCollection)
})

describe('template and scheduling', () => {
  it('imports starter template records', async () => {
    await importStarterTemplate()
    await Promise.all([
      planTemplatesCollection.preload(),
      planDaysCollection.preload(),
      exerciseTemplatesCollection.preload(),
    ])

    expect(planTemplatesCollection.toArray).toHaveLength(1)
    expect(planDaysCollection.toArray.length).toBeGreaterThan(0)
    expect(exerciseTemplatesCollection.toArray.length).toBeGreaterThan(0)
  })

  it('generates schedules idempotently', async () => {
    await importStarterTemplate()
    await planTemplatesCollection.preload()
    const template = planTemplatesCollection.toArray[0]

    expect(template).toBeDefined()

    const inserted = await generateScheduleForRange({
      templateId: template!.id,
      from: '2026-02-02',
      to: '2026-02-15',
    })

    const insertedAgain = await generateScheduleForRange({
      templateId: template!.id,
      from: '2026-02-02',
      to: '2026-02-15',
    })

    expect(inserted).toBeGreaterThan(0)
    expect(insertedAgain).toBe(0)
  })

  it('moves a skipped session to the next day and keeps the edited plan', async () => {
    await importStarterTemplate()
    await planTemplatesCollection.preload()
    const template = planTemplatesCollection.toArray[0]

    await generateScheduleForRange({
      templateId: template!.id,
      from: '2026-02-02',
      to: '2026-02-03',
    })

    await scheduledSessionsCollection.preload()
    const originalSession = scheduledSessionsCollection.toArray[0]
    expect(originalSession).toBeDefined()

    await sessionPlansCollection.preload()
    await sessionPlansCollection.insert({
      id: originalSession!.id,
      sessionId: originalSession!.id,
      title: 'Edited plan',
      notes: 'Keep this',
      exercises: [],
      updatedAt: '2026-02-02T00:00:00.000Z',
    }).isPersisted.promise

    const movedId = await moveScheduledSessionToDate(
      originalSession!.id,
      '2026-02-03',
    )

    await Promise.all([
      scheduledSessionsCollection.preload(),
      sessionPlansCollection.preload(),
    ])

    expect(scheduledSessionsCollection.has(originalSession!.id)).toBe(false)
    expect(scheduledSessionsCollection.has(movedId)).toBe(true)

    const movedSession = scheduledSessionsCollection.get(movedId)
    expect(movedSession?.date).toBe('2026-02-03')
    expect(movedSession?.status).toBe('planned')

    expect(sessionPlansCollection.has(originalSession!.id)).toBe(false)
    const movedPlan = sessionPlansCollection.get(movedId)
    expect(movedPlan?.title).toBe('Edited plan')
    expect(movedPlan?.notes).toBe('Keep this')
  })
})

describe('workout target weight', () => {
  it('stores target weight on create', async () => {
    const workout = await addWorkout({
      date: '2026-02-21',
      type: 'lift',
      durationMin: 45,
      targetWeightKg: 97.5,
    })

    await workoutsCollection.preload()
    expect(workoutsCollection.get(workout.id)?.targetWeightKg).toBe(97.5)
  })

  it('updates target weight on edit', async () => {
    const workout = await addWorkout({
      date: '2026-02-21',
      type: 'lift',
      durationMin: 45,
    })

    await updateWorkout(workout.id, {
      date: '2026-02-21',
      type: 'lift',
      durationMin: 45,
      targetWeightKg: 105,
    })

    await workoutsCollection.preload()
    expect(workoutsCollection.get(workout.id)?.targetWeightKg).toBe(105)
  })
})

describe('clearDataAfterDate', () => {
  it('clears workouts and sessions after the selected day and cleans linked artifacts', async () => {
    const now = '2026-02-01T00:00:00.000Z'

    await workoutsCollection.insert([
      {
        id: 'workout-past',
        date: '2026-02-10',
        type: 'lift',
        durationMin: 45,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'workout-future',
        date: '2026-02-13',
        type: 'lift',
        durationMin: 35,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-future-completed',
      },
      {
        id: 'workout-detached',
        date: '2026-02-10',
        type: 'run',
        durationMin: 25,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-future-planned',
      },
    ]).isPersisted.promise

    await scheduledSessionsCollection.insert([
      {
        id: 'session-past',
        templateId: 'template-1',
        planDayId: 'day-1',
        date: '2026-02-10',
        status: 'completed',
        workoutId: 'workout-past',
      },
      {
        id: 'session-future-completed',
        templateId: 'template-1',
        planDayId: 'day-2',
        date: '2026-02-13',
        status: 'completed',
        workoutId: 'workout-future',
      },
      {
        id: 'session-future-planned',
        templateId: 'template-1',
        planDayId: 'day-3',
        date: '2026-02-14',
        status: 'planned',
      },
    ]).isPersisted.promise

    await activeSessionDraftsCollection.insert({
      sessionId: 'session-future-planned',
      startedAt: now,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      setLogs: [],
      timerPaused: true,
      updatedAt: now,
    }).isPersisted.promise

    await sessionPlansCollection.insert({
      id: 'session-future-planned',
      sessionId: 'session-future-planned',
      title: 'Future plan',
      exercises: [],
      updatedAt: now,
    }).isPersisted.promise

    const result = await clearDataAfterDate('2026-02-10')

    await Promise.all([
      workoutsCollection.preload(),
      scheduledSessionsCollection.preload(),
      activeSessionDraftsCollection.preload(),
      sessionPlansCollection.preload(),
    ])

    expect(result).toEqual({ workoutsDeleted: 1, sessionsDeleted: 2 })
    expect(workoutsCollection.has('workout-future')).toBe(false)
    expect(workoutsCollection.get('workout-detached')?.scheduledSessionId).toBeUndefined()

    expect(scheduledSessionsCollection.has('session-future-completed')).toBe(false)
    expect(scheduledSessionsCollection.has('session-future-planned')).toBe(false)
    expect(scheduledSessionsCollection.has('session-past')).toBe(true)

    expect(activeSessionDraftsCollection.has('session-future-planned')).toBe(false)
    expect(sessionPlansCollection.has('session-future-planned')).toBe(false)
  })
})
