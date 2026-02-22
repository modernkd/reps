import { describe, expect, it } from 'vitest'

import type { ExerciseProgressSummary } from './selectors'
import {
  buildExerciseDetailTarget,
  getExerciseDetailSeedNames,
  resolveExerciseDetailEntry,
} from './exerciseDetailRoute'

function summary(overrides: Partial<ExerciseProgressSummary>): ExerciseProgressSummary {
  return {
    key: 'placeholder',
    exerciseId: 'placeholder',
    name: 'Placeholder',
    lastRecordedAt: null,
    lastWeightKg: null,
    totalLogs: 0,
    logs: [],
    weightPoints: [],
    ...overrides,
  }
}

describe('exerciseDetailRoute', () => {
  it('keeps catalog route ids while preserving selected variant keys', () => {
    const target = buildExerciseDetailTarget({
      key: 'arnold press',
      exerciseId: 'arnold press',
      name: 'Arnold Press',
    })

    expect(target).toEqual({
      routeName: 'ex_overhead_press',
      entryKey: 'arnold press',
    })
  })

  it('resolves the explicitly selected variant entry first', () => {
    const entries = [
      summary({
        key: 'shoulder press',
        exerciseId: 'shoulder press',
        name: 'Shoulder Press',
      }),
      summary({
        key: 'arnold press',
        exerciseId: 'arnold press',
        name: 'Arnold Press',
      }),
    ]

    const entry = resolveExerciseDetailEntry({
      entries,
      routeName: 'ex_overhead_press',
      entryKey: 'arnold press',
    })

    expect(entry?.name).toBe('Arnold Press')
  })

  it('seeds detail names with fallback and selected entry key', () => {
    const names = getExerciseDetailSeedNames({
      routeName: 'ex_overhead_press',
      fallbackName: 'Shoulder Press',
      entryKey: 'arnold press',
    })

    expect(names).toEqual(['Shoulder Press', 'arnold press'])
  })
})
