import { describe, expect, it } from 'vitest'

import { inferWorkoutTypeFromPlanDay } from './workoutType'

describe('inferWorkoutTypeFromPlanDay', () => {
  it('defaults to lift when no plan day exists', () => {
    expect(inferWorkoutTypeFromPlanDay(undefined)).toBe('lift')
  })

  it('infers workout type from plan label', () => {
    expect(inferWorkoutTypeFromPlanDay({ label: 'Morning Run' })).toBe('run')
    expect(inferWorkoutTypeFromPlanDay({ label: 'Yoga Flow' })).toBe('yoga')
    expect(inferWorkoutTypeFromPlanDay({ label: 'Cardio Intervals' })).toBe('cardio')
    expect(inferWorkoutTypeFromPlanDay({ label: 'Mobility Session' })).toBe('mobility')
  })
})
