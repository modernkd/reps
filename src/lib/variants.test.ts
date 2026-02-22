import { describe, expect, it } from 'vitest'

import {
  getCatalogExerciseIdByName,
  getCatalogExerciseVariants,
} from './variants'

describe('variants', () => {
  it('does not collapse distinct exercises into one catalog id', () => {
    expect(getCatalogExerciseIdByName('Lat Pulldown')).toBeNull()
    expect(getCatalogExerciseIdByName('Machine Chest Press')).toBeNull()
    expect(getCatalogExerciseIdByName('Arnold Press')).toBeNull()
    expect(getCatalogExerciseIdByName('Bench Press')).toBeNull()
  })

  it('maps only canonical local exercise names to their exercise id', () => {
    expect(getCatalogExerciseIdByName('Barbell Bench Press - Medium Grip')).toBe(
      'ex_bench_press',
    )
    expect(getCatalogExerciseIdByName('Barbell Shoulder Press')).toBe(
      'ex_overhead_press',
    )
    expect(getCatalogExerciseIdByName('Barbell Deadlift')).toBe('ex_deadlift')
  })

  it('includes canonical local database names in variant options', () => {
    expect(getCatalogExerciseVariants('ex_bench_press')).toContain(
      'Barbell Bench Press - Medium Grip',
    )
  })
})
