import { describe, expect, it } from 'vitest'

import { estimateWorkoutCaloriesBurned } from './calories'

describe('estimateWorkoutCaloriesBurned', () => {
  it('estimates calories for strength workouts with set logs', () => {
    const estimate = estimateWorkoutCaloriesBurned({
      durationMin: 45,
      type: 'lift',
      intensity: 'medium',
      sessionSummary: {
        startedAt: '2026-02-01T10:00:00.000Z',
        endedAt: '2026-02-01T10:45:00.000Z',
        totalDurationMin: 45,
        setLogs: Array.from({ length: 10 }, (_, index) => ({
          exerciseId: `e-${index}`,
          setIndex: index,
          restSecUsed: 75,
        })),
      },
    })

    expect(estimate).toBe(310)
  })

  it('applies intensity multiplier for cardio workouts', () => {
    const estimate = estimateWorkoutCaloriesBurned({
      durationMin: 30,
      type: 'cardio',
      intensity: 'high',
      sessionSummary: undefined,
    })

    expect(estimate).toBe(275)
  })

  it('falls back to lifting rate for unknown workout types', () => {
    const estimate = estimateWorkoutCaloriesBurned({
      durationMin: 20,
      type: 'custom',
      intensity: undefined,
      sessionSummary: undefined,
    })

    expect(estimate).toBe(120)
  })
})
