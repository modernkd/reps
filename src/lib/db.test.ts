import { parseISO } from 'date-fns'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  activeSessionDraftsCollection,
  addWorkout,
  applyTemplateToCalendar,
  clearDataAfterDate,
  clearDataBeforeDate,
  clearAllUncompletedSessions,
  completeGuidedSession,
  createPlanTemplate,
  deleteWorkout,
  deletePlanTemplate,
  duplicateScheduledSession,
  exerciseTemplatesCollection,
  exportWorkoutDataSnapshot,
  generateScheduleForRange,
  getOrCreateSessionPlan,
  importStarterTemplate,
  LAST_TEMPLATE_DELETE_ERROR,
  MANUAL_PLAN_DAY_ID,
  MANUAL_TEMPLATE_ID,
  MIN_TEMPLATE_COUNT,
  moveScheduledSessionToDate,
  planDaysCollection,
  planManualWorkout,
  planTemplatesCollection,
  replaceWorkoutDataSnapshot,
  scheduledSessionsCollection,
  serializeWorkoutDataSnapshot,
  sessionPlansCollection,
  resetCompletedSession,
  updatePlanTemplate,
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

  it('creates a custom template and schedules only from the selected start date', async () => {
    const template = await createPlanTemplate({
      name: 'Custom split',
      startDate: '2026-02-10',
      days: [
        {
          weekday: 2,
          label: 'Tuesday session',
          exercises: [
            {
              name: 'Back Squat',
              sets: 5,
              minReps: 3,
              maxReps: 5,
              restSecDefault: 150,
            },
          ],
        },
      ],
    })

    await Promise.all([
      planTemplatesCollection.preload(),
      planDaysCollection.preload(),
      exerciseTemplatesCollection.preload(),
    ])

    const templateDays = planDaysCollection.toArray.filter(
      (day) => day.templateId === template.id,
    )
    const templateDayIds = new Set(templateDays.map((day) => day.id))

    expect(planTemplatesCollection.get(template.id)?.startDate).toBe('2026-02-10')
    expect(templateDays).toHaveLength(1)
    expect(
      exerciseTemplatesCollection.toArray.filter((exercise) =>
        templateDayIds.has(exercise.planDayId),
      ),
    ).toHaveLength(1)

    const inserted = await generateScheduleForRange({
      templateId: template.id,
      from: '2026-02-02',
      to: '2026-02-16',
    })

    await scheduledSessionsCollection.preload()
    const sessionDates = scheduledSessionsCollection.toArray
      .filter((session) => session.templateId === template.id)
      .map((session) => session.date)

    expect(inserted).toBe(1)
    expect(sessionDates).toEqual(['2026-02-10'])
  })

  it('updates a template and rebuilds scheduled sessions', async () => {
    const template = await createPlanTemplate({
      name: 'Cycle',
      startDate: '2026-02-01',
      days: [
        {
          weekday: 2,
          label: 'Day 1',
          exercises: [
            {
              name: 'Bench',
              sets: 3,
              minReps: 8,
              maxReps: 10,
              restSecDefault: 90,
            },
          ],
        },
      ],
    })

    await generateScheduleForRange({
      templateId: template.id,
      from: '2026-02-01',
      to: '2026-02-08',
    })

    await scheduledSessionsCollection.preload()
    expect(
      scheduledSessionsCollection.toArray.filter(
        (session) => session.templateId === template.id,
      ).length,
    ).toBeGreaterThan(0)

    await updatePlanTemplate({
      templateId: template.id,
      name: 'Updated cycle',
      startDate: '2026-02-01',
      days: [
        {
          weekday: 4,
          label: 'Thursday session',
          exercises: [
            {
              name: 'Deadlift',
              sets: 5,
              minReps: 3,
              maxReps: 5,
              restSecDefault: 150,
            },
          ],
        },
      ],
    })

    await Promise.all([
      planTemplatesCollection.preload(),
      planDaysCollection.preload(),
      scheduledSessionsCollection.preload(),
    ])

    expect(planTemplatesCollection.get(template.id)?.name).toBe('Updated cycle')
    const updatedPlanDays = planDaysCollection.toArray.filter(
      (day) => day.templateId === template.id,
    )
    expect(updatedPlanDays).toHaveLength(1)
    expect(updatedPlanDays[0]?.weekday).toBe(4)
    expect(
      scheduledSessionsCollection.toArray.filter(
        (session) => session.templateId === template.id,
      ),
    ).toHaveLength(0)

    await generateScheduleForRange({
      templateId: template.id,
      from: '2026-02-01',
      to: '2026-02-08',
    })

    const updatedSessions = scheduledSessionsCollection.toArray.filter(
      (session) => session.templateId === template.id,
    )
    expect(updatedSessions.length).toBeGreaterThan(0)
    updatedSessions.forEach((session) => {
      const jsWeekday = parseISO(session.date).getDay()
      const isoWeekday = ((jsWeekday + 6) % 7) + 1
      expect(isoWeekday).toBe(4)
    })
  })

  it('deletes a template and related plan entities', async () => {
    const template = await createPlanTemplate({
      name: 'Delete me',
      startDate: '2026-02-01',
      days: [
        {
          weekday: 1,
          label: 'Monday',
          exercises: [{ name: 'Row', sets: 4 }],
        },
      ],
    })
    await createPlanTemplate({
      name: 'Keep me',
      startDate: '2026-02-01',
      days: [
        {
          weekday: 3,
          label: 'Wednesday',
          exercises: [{ name: 'Press', sets: 3 }],
        },
      ],
    })

    await generateScheduleForRange({
      templateId: template.id,
      from: '2026-02-01',
      to: '2026-02-14',
    })

    await deletePlanTemplate(template.id)

    await Promise.all([
      planTemplatesCollection.preload(),
      planDaysCollection.preload(),
      exerciseTemplatesCollection.preload(),
      scheduledSessionsCollection.preload(),
    ])

    expect(planTemplatesCollection.get(template.id)).toBeUndefined()
    expect(
      planDaysCollection.toArray.filter((day) => day.templateId === template.id),
    ).toHaveLength(0)
    expect(
      scheduledSessionsCollection.toArray.filter(
        (session) => session.templateId === template.id,
      ),
    ).toHaveLength(0)
  })

  it('prevents deleting the final remaining template', async () => {
    await importStarterTemplate()
    await planTemplatesCollection.preload()

    const template = planTemplatesCollection.toArray[0]
    expect(template).toBeDefined()
    expect(planTemplatesCollection.toArray).toHaveLength(MIN_TEMPLATE_COUNT)

    await expect(deletePlanTemplate(template!.id)).rejects.toThrow(
      LAST_TEMPLATE_DELETE_ERROR,
    )

    await planTemplatesCollection.preload()
    expect(planTemplatesCollection.toArray).toHaveLength(MIN_TEMPLATE_COUNT)
    expect(planTemplatesCollection.get(template!.id)).toBeDefined()
  })

  it('applies an existing template from selected date without creating a new template', async () => {
    const template = await createPlanTemplate({
      name: 'Apply target',
      startDate: '2026-02-01',
      days: [
        {
          weekday: 1,
          label: 'Upper body',
          exercises: [{ name: 'Bench Press', sets: 4 }],
        },
      ],
    })

    await generateScheduleForRange({
      templateId: template.id,
      from: '2026-02-01',
      to: '2026-02-28',
    })

    const result = await applyTemplateToCalendar({
      templateId: template.id,
      startDate: '2026-02-15',
      to: '2026-02-28',
    })

    await Promise.all([
      planTemplatesCollection.preload(),
      scheduledSessionsCollection.preload(),
    ])

    expect(planTemplatesCollection.toArray).toHaveLength(1)
    expect(planTemplatesCollection.get(template.id)?.startDate).toBe('2026-02-15')
    expect(result.removed).toBe(4)

    const sessionDates = scheduledSessionsCollection.toArray
      .filter((session) => session.templateId === template.id)
      .map((session) => session.date)
      .sort()

    expect(sessionDates).toEqual(['2026-02-16', '2026-02-23'])
  })

  it('can start a template from a chosen template day on selected date', async () => {
    const template = await createPlanTemplate({
      name: 'Upper lower',
      startDate: '2026-02-01',
      days: [
        {
          weekday: 1,
          label: 'Upper body',
          exercises: [{ name: 'Bench Press', sets: 4 }],
        },
        {
          weekday: 3,
          label: 'Lower body',
          exercises: [{ name: 'Back Squat', sets: 4 }],
        },
      ],
    })

    await planDaysCollection.preload()
    const upperDay = planDaysCollection.toArray.find(
      (day) => day.templateId === template.id && day.label === 'Upper body',
    )
    const lowerDay = planDaysCollection.toArray.find(
      (day) => day.templateId === template.id && day.label === 'Lower body',
    )
    expect(upperDay).toBeDefined()
    expect(lowerDay).toBeDefined()

    await applyTemplateToCalendar({
      templateId: template.id,
      startDate: '2026-02-10',
      to: '2026-02-17',
      startPlanDayId: upperDay!.id,
    })

    await Promise.all([
      planDaysCollection.preload(),
      scheduledSessionsCollection.preload(),
    ])

    const updatedUpper = planDaysCollection.get(upperDay!.id)
    const updatedLower = planDaysCollection.get(lowerDay!.id)

    expect(updatedUpper?.weekday).toBe(2)
    expect(updatedLower?.weekday).toBe(4)

    const upperSession = scheduledSessionsCollection.toArray.find(
      (session) =>
        session.templateId === template.id &&
        session.planDayId === upperDay!.id &&
        session.date === '2026-02-10',
    )
    expect(upperSession).toBeDefined()
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
    const originalSession = scheduledSessionsCollection.toArray.find(
      (session) => session.date === '2026-02-02',
    )
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

  it('plans a manual workout with the provided details', async () => {
    const session = await planManualWorkout({
      date: '2026-02-21',
      type: 'run',
      durationMin: 45,
      intensity: 'medium',
      targetWeightKg: 80,
      notes: 'Plan this one',
    })

    await Promise.all([
      scheduledSessionsCollection.preload(),
      planDaysCollection.preload(),
    ])

    expect(session.templateId).toBe(MANUAL_TEMPLATE_ID)
    expect(session.planDayId).toBe(MANUAL_PLAN_DAY_ID)
    expect(session.plannedWorkout?.type).toBe('run')
    expect(planDaysCollection.get(MANUAL_PLAN_DAY_ID)?.label).toBe('Planned workout')
    expect(session.plannedWorkout?.notes).toBe('Plan this one')
  })

  it('duplicates a planned session for a later date', async () => {
    const session = await planManualWorkout({
      date: '2026-02-21',
      type: 'lift',
      durationMin: 60,
    })

    await sessionPlansCollection.insert({
      id: session.id,
      sessionId: session.id,
      title: 'Custom plan',
      notes: 'Keep accessories',
      exercises: [],
      updatedAt: '2026-02-21T00:00:00.000Z',
    }).isPersisted.promise

    const duplicated = await duplicateScheduledSession(session.id, '2026-02-28')

    await sessionPlansCollection.preload()

    expect(duplicated.date).toBe('2026-02-28')
    expect(duplicated.templateId).toBe(session.templateId)
    expect(duplicated.planDayId).toBe(session.planDayId)
    expect(duplicated.plannedWorkout).toEqual(session.plannedWorkout)
    expect(sessionPlansCollection.get(duplicated.id)?.title).toBe('Custom plan')
    expect(sessionPlansCollection.get(duplicated.id)?.notes).toBe('Keep accessories')
  })

  it('completes manual sessions using planned workout values', async () => {
    const session = await planManualWorkout({
      date: '2026-02-21',
      type: 'cardio',
      durationMin: 30,
      distanceKm: 5,
      intensity: 'high',
      notes: 'Intervals',
    })

    const completedWorkout = await completeGuidedSession({
      sessionId: session.id,
      summary: {
        startedAt: '2026-02-21T09:00:00.000Z',
        endedAt: '2026-02-21T09:30:00.000Z',
        totalDurationMin: 0,
        setLogs: [],
      },
    })

    await Promise.all([workoutsCollection.preload(), scheduledSessionsCollection.preload()])

    expect(completedWorkout.type).toBe('cardio')
    expect(completedWorkout.durationMin).toBe(30)
    expect(completedWorkout.distanceKm).toBe(5)
    expect(completedWorkout.intensity).toBe('high')
    expect(completedWorkout.notes).toBe('Intervals')
    expect(scheduledSessionsCollection.get(session.id)?.status).toBe('completed')
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

describe('deleteWorkout and resetCompletedSession', () => {
  it('deletes linked scheduled session and artifacts when deleting a workout', async () => {
    const now = '2026-02-01T00:00:00.000Z'

    await workoutsCollection.insert({
      id: 'workout-1',
      date: '2026-02-10',
      type: 'lift',
      durationMin: 45,
      createdAt: now,
      updatedAt: now,
      scheduledSessionId: 'session-1',
    }).isPersisted.promise

    await scheduledSessionsCollection.insert({
      id: 'session-1',
      templateId: 'template-1',
      planDayId: 'day-1',
      date: '2026-02-10',
      status: 'completed',
      workoutId: 'workout-1',
    }).isPersisted.promise

    await activeSessionDraftsCollection.insert({
      sessionId: 'session-1',
      startedAt: now,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      setLogs: [],
      timerPaused: true,
      updatedAt: now,
    }).isPersisted.promise

    await sessionPlansCollection.insert({
      id: 'session-1',
      sessionId: 'session-1',
      title: 'Linked plan',
      exercises: [],
      updatedAt: now,
    }).isPersisted.promise

    await deleteWorkout('workout-1')

    await Promise.all([
      workoutsCollection.preload(),
      scheduledSessionsCollection.preload(),
      activeSessionDraftsCollection.preload(),
      sessionPlansCollection.preload(),
    ])

    expect(workoutsCollection.has('workout-1')).toBe(false)
    expect(scheduledSessionsCollection.has('session-1')).toBe(false)
    expect(activeSessionDraftsCollection.has('session-1')).toBe(false)
    expect(sessionPlansCollection.has('session-1')).toBe(false)
  })

  it('keeps the scheduled session when resetting a completed session', async () => {
    const now = '2026-02-01T00:00:00.000Z'

    await workoutsCollection.insert({
      id: 'workout-1',
      date: '2026-02-10',
      type: 'lift',
      durationMin: 45,
      createdAt: now,
      updatedAt: now,
      scheduledSessionId: 'session-1',
    }).isPersisted.promise

    await scheduledSessionsCollection.insert({
      id: 'session-1',
      templateId: 'template-1',
      planDayId: 'day-1',
      date: '2026-02-10',
      status: 'completed',
      workoutId: 'workout-1',
    }).isPersisted.promise

    await resetCompletedSession('session-1')

    await Promise.all([workoutsCollection.preload(), scheduledSessionsCollection.preload()])

    expect(workoutsCollection.has('workout-1')).toBe(false)
    expect(scheduledSessionsCollection.has('session-1')).toBe(true)
    expect(scheduledSessionsCollection.get('session-1')).toMatchObject({
      id: 'session-1',
      status: 'planned',
      workoutId: undefined,
    })
  })
})

describe('clearDataAfterDate', () => {
  it('clears uncompleted sessions after the selected day and preserves completed history', async () => {
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

    expect(result).toEqual({ workoutsDeleted: 0, sessionsDeleted: 1 })
    expect(workoutsCollection.has('workout-future')).toBe(true)
    expect(workoutsCollection.get('workout-detached')?.scheduledSessionId).toBeUndefined()

    expect(scheduledSessionsCollection.has('session-future-completed')).toBe(true)
    expect(scheduledSessionsCollection.has('session-future-planned')).toBe(false)
    expect(scheduledSessionsCollection.has('session-past')).toBe(true)

    expect(activeSessionDraftsCollection.has('session-future-planned')).toBe(false)
    expect(sessionPlansCollection.has('session-future-planned')).toBe(false)
  })

  it('prevents schedule regeneration after the cleared date', async () => {
    await importStarterTemplate()
    await planTemplatesCollection.preload()
    const template = planTemplatesCollection.toArray[0]

    expect(template).toBeDefined()

    await generateScheduleForRange({
      templateId: template!.id,
      from: '2026-02-01',
      to: '2026-03-31',
    })

    await clearDataAfterDate('2026-02-10')

    const insertedAfterClear = await generateScheduleForRange({
      templateId: template!.id,
      from: '2026-02-11',
      to: '2026-04-30',
    })

    await Promise.all([
      planTemplatesCollection.preload(),
      scheduledSessionsCollection.preload(),
    ])

    const updatedTemplate = planTemplatesCollection.get(template!.id)
    expect(updatedTemplate?.endDate).toBe('2026-02-10')
    expect(insertedAfterClear).toBe(0)
    expect(
      scheduledSessionsCollection.toArray.some((session) => session.date > '2026-02-10'),
    ).toBe(false)
  })

  it('clears records after the selected day when stored dates are not zero-padded', async () => {
    const now = '2026-02-01T00:00:00.000Z'

    await workoutsCollection.insert([
      {
        id: 'workout-iso',
        date: '2026-02-09',
        type: 'run',
        durationMin: 20,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'workout-non-padded',
        date: '2026-2-13',
        type: 'run',
        durationMin: 25,
        createdAt: now,
        updatedAt: now,
      },
    ]).isPersisted.promise

    await scheduledSessionsCollection.insert([
      {
        id: 'session-iso',
        templateId: 'template-1',
        planDayId: 'day-1',
        date: '2026-02-09',
        status: 'planned',
      },
      {
        id: 'session-non-padded',
        templateId: 'template-1',
        planDayId: 'day-2',
        date: '2026-2-13',
        status: 'planned',
      },
    ]).isPersisted.promise

    const result = await clearDataAfterDate('2026-02-10')

    await Promise.all([workoutsCollection.preload(), scheduledSessionsCollection.preload()])

    expect(result).toEqual({ workoutsDeleted: 0, sessionsDeleted: 1 })
    expect(workoutsCollection.has('workout-non-padded')).toBe(true)
    expect(scheduledSessionsCollection.has('session-non-padded')).toBe(false)
    expect(workoutsCollection.has('workout-iso')).toBe(true)
    expect(scheduledSessionsCollection.has('session-iso')).toBe(true)
  })
})

describe('clearAllUncompletedSessions', () => {
  it('removes every non-completed scheduled session and cleans linked records', async () => {
    const now = '2026-02-01T00:00:00.000Z'

    await workoutsCollection.insert([
      {
        id: 'workout-planned',
        date: '2026-02-10',
        type: 'lift',
        durationMin: 45,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-planned',
      },
      {
        id: 'workout-in-progress',
        date: '2026-02-11',
        type: 'run',
        durationMin: 30,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-in-progress',
      },
      {
        id: 'workout-skipped',
        date: '2026-02-12',
        type: 'yoga',
        durationMin: 20,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-skipped',
      },
      {
        id: 'workout-completed',
        date: '2026-02-13',
        type: 'lift',
        durationMin: 40,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-completed',
      },
    ]).isPersisted.promise

    await scheduledSessionsCollection.insert([
      {
        id: 'session-planned',
        templateId: 'template-1',
        planDayId: 'day-1',
        date: '2026-02-10',
        status: 'planned',
        workoutId: 'workout-planned',
      },
      {
        id: 'session-in-progress',
        templateId: 'template-1',
        planDayId: 'day-2',
        date: '2026-02-11',
        status: 'in_progress',
        workoutId: 'workout-in-progress',
      },
      {
        id: 'session-skipped',
        templateId: 'template-1',
        planDayId: 'day-3',
        date: '2026-02-12',
        status: 'skipped',
        workoutId: 'workout-skipped',
      },
      {
        id: 'session-completed',
        templateId: 'template-1',
        planDayId: 'day-4',
        date: '2026-02-13',
        status: 'completed',
        workoutId: 'workout-completed',
      },
    ]).isPersisted.promise

    await activeSessionDraftsCollection.insert({
      sessionId: 'session-in-progress',
      startedAt: now,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      setLogs: [],
      timerPaused: false,
      updatedAt: now,
    }).isPersisted.promise

    await sessionPlansCollection.insert({
      id: 'session-in-progress',
      sessionId: 'session-in-progress',
      title: 'In-progress plan',
      exercises: [],
      updatedAt: now,
    }).isPersisted.promise

    const result = await clearAllUncompletedSessions()

    await Promise.all([
      workoutsCollection.preload(),
      scheduledSessionsCollection.preload(),
      activeSessionDraftsCollection.preload(),
      sessionPlansCollection.preload(),
    ])

    expect(result).toEqual({ sessionsDeleted: 3 })
    expect(scheduledSessionsCollection.has('session-completed')).toBe(true)
    expect(scheduledSessionsCollection.has('session-planned')).toBe(false)
    expect(scheduledSessionsCollection.has('session-in-progress')).toBe(false)
    expect(scheduledSessionsCollection.has('session-skipped')).toBe(false)
    expect(workoutsCollection.get('workout-planned')?.scheduledSessionId).toBeUndefined()
    expect(workoutsCollection.get('workout-in-progress')?.scheduledSessionId).toBeUndefined()
    expect(workoutsCollection.get('workout-skipped')?.scheduledSessionId).toBeUndefined()
    expect(workoutsCollection.get('workout-completed')?.scheduledSessionId).toBe(
      'session-completed',
    )
    expect(activeSessionDraftsCollection.has('session-in-progress')).toBe(false)
    expect(sessionPlansCollection.has('session-in-progress')).toBe(false)
  })

  it('returns zero when there are no non-completed sessions', async () => {
    const now = '2026-02-01T00:00:00.000Z'

    await scheduledSessionsCollection.insert({
      id: 'session-completed-only',
      templateId: 'template-1',
      planDayId: 'day-1',
      date: '2026-02-02',
      status: 'completed',
    }).isPersisted.promise

    const result = await clearAllUncompletedSessions()

    await scheduledSessionsCollection.preload()

    expect(result).toEqual({ sessionsDeleted: 0 })
    expect(scheduledSessionsCollection.has('session-completed-only')).toBe(true)
  })
})

describe('clearDataBeforeDate', () => {
  it('clears uncompleted sessions before the selected day and preserves completed history', async () => {
    const now = '2026-02-01T00:00:00.000Z'

    await workoutsCollection.insert([
      {
        id: 'workout-future',
        date: '2026-02-10',
        type: 'lift',
        durationMin: 45,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'workout-past',
        date: '2026-02-08',
        type: 'lift',
        durationMin: 35,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-past-completed',
      },
      {
        id: 'workout-detached',
        date: '2026-02-10',
        type: 'run',
        durationMin: 25,
        createdAt: now,
        updatedAt: now,
        scheduledSessionId: 'session-past-planned',
      },
    ]).isPersisted.promise

    await scheduledSessionsCollection.insert([
      {
        id: 'session-future',
        templateId: 'template-1',
        planDayId: 'day-1',
        date: '2026-02-10',
        status: 'completed',
        workoutId: 'workout-future',
      },
      {
        id: 'session-past-completed',
        templateId: 'template-1',
        planDayId: 'day-2',
        date: '2026-02-08',
        status: 'completed',
        workoutId: 'workout-past',
      },
      {
        id: 'session-past-planned',
        templateId: 'template-1',
        planDayId: 'day-3',
        date: '2026-02-07',
        status: 'planned',
      },
    ]).isPersisted.promise

    await activeSessionDraftsCollection.insert({
      sessionId: 'session-past-planned',
      startedAt: now,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      setLogs: [],
      timerPaused: true,
      updatedAt: now,
    }).isPersisted.promise

    await sessionPlansCollection.insert({
      id: 'session-past-planned',
      sessionId: 'session-past-planned',
      title: 'Past plan',
      exercises: [],
      updatedAt: now,
    }).isPersisted.promise

    const result = await clearDataBeforeDate('2026-02-10')

    await Promise.all([
      workoutsCollection.preload(),
      scheduledSessionsCollection.preload(),
      activeSessionDraftsCollection.preload(),
      sessionPlansCollection.preload(),
    ])

    expect(result).toEqual({ workoutsDeleted: 0, sessionsDeleted: 1 })
    expect(workoutsCollection.has('workout-past')).toBe(true)
    expect(workoutsCollection.get('workout-detached')?.scheduledSessionId).toBeUndefined()

    expect(scheduledSessionsCollection.has('session-past-completed')).toBe(true)
    expect(scheduledSessionsCollection.has('session-past-planned')).toBe(false)
    expect(scheduledSessionsCollection.has('session-future')).toBe(true)

    expect(activeSessionDraftsCollection.has('session-past-planned')).toBe(false)
    expect(sessionPlansCollection.has('session-past-planned')).toBe(false)
  })

  it('prevents schedule regeneration before the cleared date', async () => {
    await importStarterTemplate()
    await planTemplatesCollection.preload()
    const template = planTemplatesCollection.toArray[0]

    expect(template).toBeDefined()

    await generateScheduleForRange({
      templateId: template!.id,
      from: '2026-01-01',
      to: '2026-02-28',
    })

    await clearDataBeforeDate('2026-02-10')

    const insertedBeforeClear = await generateScheduleForRange({
      templateId: template!.id,
      from: '2026-01-01',
      to: '2026-02-09',
    })

    await Promise.all([
      planTemplatesCollection.preload(),
      scheduledSessionsCollection.preload(),
    ])

    const updatedTemplate = planTemplatesCollection.get(template!.id)
    expect(updatedTemplate?.startDate).toBe('2026-02-10')
    expect(insertedBeforeClear).toBe(0)
    expect(
      scheduledSessionsCollection.toArray.some((session) => session.date < '2026-02-10'),
    ).toBe(false)
  })
})

describe('workout data snapshot sync', () => {
  it('exports and restores all persisted collections', async () => {
    await importStarterTemplate()
    const manualSession = await planManualWorkout({
      date: '2026-02-20',
      type: 'lift',
      durationMin: 40,
      notes: 'sync test',
    })

    await getOrCreateSessionPlan(manualSession.id)

    const snapshot = exportWorkoutDataSnapshot()
    const snapshotJson = serializeWorkoutDataSnapshot(snapshot)

    await clearSessionDraftCollection()
    await clearCollection(sessionPlansCollection)
    await clearCollection(scheduledSessionsCollection)
    await clearCollection(workoutsCollection)
    await clearCollection(exerciseTemplatesCollection)
    await clearCollection(planDaysCollection)
    await clearCollection(planTemplatesCollection)

    await replaceWorkoutDataSnapshot(snapshot)
    await Promise.all([
      workoutsCollection.preload(),
      planTemplatesCollection.preload(),
      scheduledSessionsCollection.preload(),
      sessionPlansCollection.preload(),
    ])

    expect(planTemplatesCollection.toArray.length).toBeGreaterThan(0)
    expect(workoutsCollection.toArray.length).toBeGreaterThan(0)
    expect(scheduledSessionsCollection.has(manualSession.id)).toBe(true)
    expect(sessionPlansCollection.has(manualSession.id)).toBe(true)
    expect(serializeWorkoutDataSnapshot(exportWorkoutDataSnapshot())).toBe(snapshotJson)
  })
})
