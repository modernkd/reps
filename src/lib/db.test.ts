import { beforeEach, describe, expect, it } from 'vitest'

import {
  exerciseTemplatesCollection,
  generateScheduleForRange,
  importStarterTemplate,
  moveScheduledSessionToDate,
  planDaysCollection,
  planTemplatesCollection,
  scheduledSessionsCollection,
  sessionPlansCollection,
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

beforeEach(async () => {
  window.localStorage.clear()

  await clearCollection(scheduledSessionsCollection)
  await clearCollection(sessionPlansCollection)
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
