import { describe, expect, it } from 'vitest'

import {
  getAllExerciseNames,
  getAllEquipmentTypes,
  getAllLevels,
  getAllMuscleGroups,
  getExerciseByName,
  getExercisesByCategory,
  getExercisesByEquipment,
  getExercisesByLevel,
  getExercisesByMuscle,
  searchExercises,
} from './exerciseDb'

describe('exerciseDb', () => {
  describe('getExerciseByName', () => {
    it('finds exercise by exact name', async () => {
      const result = await getExerciseByName('Barbell Bench Press - Medium Grip')
      expect(result).toBeDefined()
      expect(result?.name).toBe('Barbell Bench Press - Medium Grip')
      expect(result?.equipment).toBe('barbell')
      expect(result?.primaryMuscles).toContain('chest')
    })

    it('finds exercise by normalized name (case-insensitive)', async () => {
      const result = await getExerciseByName('barbell bench press - medium grip')
      expect(result).toBeDefined()
      expect(result?.name).toBe('Barbell Bench Press - Medium Grip')
    })

    it('finds exercise by fuzzy match (substring)', async () => {
      const result = await getExerciseByName('bench press')
      expect(result).toBeDefined()
      expect(result?.name).toContain('Bench Press')
    })

    it('returns undefined for non-existent exercise', async () => {
      const result = await getExerciseByName('Nonexistent Exercise XYZ')
      expect(result).toBeUndefined()
    })

    it('handles empty string', async () => {
      const result = await getExerciseByName('')
      expect(result).toBeUndefined()
    })
  })

  describe('searchExercises', () => {
    it('searches by name substring', async () => {
      const results = await searchExercises('bench')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.name.toLowerCase().includes('bench'))).toBe(true)
    })

    it('searches by primary muscle', async () => {
      const results = await searchExercises('chest')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.primaryMuscles?.includes('chest'))).toBe(true)
    })

    it('searches by equipment', async () => {
      const results = await searchExercises('barbell')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.equipment === 'barbell')).toBe(true)
    })

    it('returns empty array for empty query', async () => {
      const results = await searchExercises('')
      expect(results).toEqual([])
    })

    it('returns sorted results', async () => {
      const results = await searchExercises('curl')
      const names = results.map((r) => r.name)
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b))
      expect(names).toEqual(sortedNames)
    })

    it('deduplicates results from multiple matches', async () => {
      const results = await searchExercises('squat')
      const ids = results.map((r) => r.id)
      const uniqueIds = new Set(ids)
      expect(ids.length).toBe(uniqueIds.size)
    })
  })

  describe('getExercisesByMuscle', () => {
    it('returns exercises for chest', async () => {
      const results = await getExercisesByMuscle('chest')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.primaryMuscles?.includes('chest'))).toBe(true)
    })

    it('returns exercises for biceps', async () => {
      const results = await getExercisesByMuscle('biceps')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.primaryMuscles?.includes('biceps'))).toBe(true)
    })

    it('is case-insensitive', async () => {
      const lowerResults = await getExercisesByMuscle('chest')
      const upperResults = await getExercisesByMuscle('CHEST')
      expect(lowerResults.length).toBe(upperResults.length)
    })

    it('returns empty array for non-existent muscle', async () => {
      const results = await getExercisesByMuscle('nonexistent-muscle')
      expect(results).toEqual([])
    })
  })

  describe('getExercisesByEquipment', () => {
    it('returns exercises for barbell', async () => {
      const results = await getExercisesByEquipment('barbell')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.equipment === 'barbell')).toBe(true)
    })

    it('returns exercises for dumbbell', async () => {
      const results = await getExercisesByEquipment('dumbbell')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.equipment === 'dumbbell')).toBe(true)
    })

    it('is case-insensitive', async () => {
      const lowerResults = await getExercisesByEquipment('barbell')
      const upperResults = await getExercisesByEquipment('BARBELL')
      expect(lowerResults.length).toBe(upperResults.length)
    })

    it('returns empty array for non-existent equipment', async () => {
      const results = await getExercisesByEquipment('nonexistent-equipment')
      expect(results).toEqual([])
    })
  })

  describe('getExercisesByLevel', () => {
    it('returns exercises for beginner level', async () => {
      const results = await getExercisesByLevel('beginner')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.level === 'beginner')).toBe(true)
    })

    it('returns exercises for intermediate level', async () => {
      const results = await getExercisesByLevel('intermediate')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.level === 'intermediate')).toBe(true)
    })

    it('is case-insensitive', async () => {
      const lowerResults = await getExercisesByLevel('beginner')
      const upperResults = await getExercisesByLevel('BEGINNER')
      expect(lowerResults.length).toBe(upperResults.length)
    })

    it('returns empty array for non-existent level', async () => {
      const results = await getExercisesByLevel('expert-ninja')
      expect(results).toEqual([])
    })
  })

  describe('getExercisesByCategory', () => {
    it('returns exercises for strength category', async () => {
      const results = await getExercisesByCategory('strength')
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.category === 'strength')).toBe(true)
    })

    it('is case-insensitive', async () => {
      const lowerResults = await getExercisesByCategory('strength')
      const upperResults = await getExercisesByCategory('STRENGTH')
      expect(lowerResults.length).toBe(upperResults.length)
    })

    it('returns empty array for non-existent category', async () => {
      const results = await getExercisesByCategory('nonexistent-category')
      expect(results).toEqual([])
    })
  })

  describe('getAllExerciseNames', () => {
    it('returns all exercise names', async () => {
      const names = await getAllExerciseNames()
      expect(names.length).toBeGreaterThan(0)
      expect(names).toContain('Barbell Bench Press - Medium Grip')
      expect(names).toContain('Pullups')
    })

    it('returns sorted names', async () => {
      const names = await getAllExerciseNames()
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b))
      expect(names).toEqual(sortedNames)
    })

    it('returns unique names', async () => {
      const names = await getAllExerciseNames()
      const uniqueNames = new Set(names)
      expect(names.length).toBe(uniqueNames.size)
    })
  })

  describe('getAllMuscleGroups', () => {
    it('returns all muscle groups', async () => {
      const muscles = await getAllMuscleGroups()
      expect(muscles.length).toBeGreaterThan(0)
      expect(muscles).toContain('chest')
      expect(muscles).toContain('biceps')
    })

    it('returns sorted muscle groups', async () => {
      const muscles = await getAllMuscleGroups()
      const sortedMuscles = [...muscles].sort((a, b) => a.localeCompare(b))
      expect(muscles).toEqual(sortedMuscles)
    })
  })

  describe('getAllEquipmentTypes', () => {
    it('returns all equipment types', async () => {
      const equipment = await getAllEquipmentTypes()
      expect(equipment.length).toBeGreaterThan(0)
      expect(equipment).toContain('barbell')
      expect(equipment).toContain('dumbbell')
    })

    it('returns sorted equipment types', async () => {
      const equipment = await getAllEquipmentTypes()
      const sortedEquipment = [...equipment].sort((a, b) => a.localeCompare(b))
      expect(equipment).toEqual(sortedEquipment)
    })
  })

  describe('getAllLevels', () => {
    it('returns all difficulty levels', async () => {
      const levels = await getAllLevels()
      expect(levels.length).toBeGreaterThan(0)
      expect(levels).toContain('beginner')
      expect(levels).toContain('intermediate')
    })

    it('returns sorted levels', async () => {
      const levels = await getAllLevels()
      const sortedLevels = [...levels].sort((a, b) => a.localeCompare(b))
      expect(levels).toEqual(sortedLevels)
    })
  })

  describe('starter template exercises', () => {
    it('all starter template exercises are available by ID', async () => {
      const starterExerciseIds = [
        'ex_bench_press',
        'ex_pullups',
        'ex_overhead_press',
        'ex_incline_db_press',
        'ex_biceps_curl',
        'ex_triceps_pushdown',
        'ex_back_squat',
        'ex_rdl',
        'ex_lunges',
        'ex_leg_curl',
        'ex_calf_raise',
        'ex_barbell_row',
        'ex_incline_bench',
        'ex_lateral_raise',
        'ex_cable_row',
        'ex_hammer_curl',
        'ex_skull_crusher',
        'ex_deadlift',
        'ex_front_squat',
        'ex_hip_thrust',
        'ex_leg_extension',
        'ex_seated_calf_raise',
      ]

      for (const id of starterExerciseIds) {
        const exercise = await getExerciseByName(id)
        expect(exercise).toBeDefined()
        expect(exercise?.id).toBeTruthy()
        expect(exercise?.name).toBeTruthy()
      }
    })

    it('starter exercises have complete metadata', async () => {
      const benchPress = await getExerciseByName('Bench Press')
      expect(benchPress).toBeDefined()
      expect(benchPress?.level).toBeDefined()
      expect(benchPress?.equipment).toBeDefined()
      expect(benchPress?.primaryMuscles).toBeDefined()
      expect(benchPress?.instructions).toBeDefined()
      expect(benchPress?.images).toBeDefined()
      expect(benchPress!.images!.length).toBeGreaterThan(0)
    })
  })
})
