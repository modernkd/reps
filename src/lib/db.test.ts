import { beforeEach, describe, expect, it } from 'vitest'

import {
  exerciseTemplatesCollection,
  generateScheduleForRange,
  importStarterTemplate,
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
})
