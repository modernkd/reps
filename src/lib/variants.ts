const VARIANT_CATALOG: Record<string, string[]> = {
  ex_pullups: ['Pull-ups', 'Assisted Pull-ups', 'Lat Pulldown', 'Neutral Grip Pulldown'],
  ex_bench_press: ['Bench Press', 'Dumbbell Bench Press', 'Machine Chest Press'],
  ex_overhead_press: ['Shoulder Press', 'Dumbbell Shoulder Press', 'Arnold Press'],
  ex_incline_db_press: ['Incline Dumbbell Press', 'Incline Barbell Press', 'Machine Incline Press'],
  ex_back_squat: ['Back Squat', 'Safety Bar Squat', 'Hack Squat'],
  ex_rdl: ['Romanian Deadlift', 'Stiff-Leg Deadlift', 'Cable Pull-through'],
  ex_lunges: ['Walking Lunges', 'Split Squat', 'Reverse Lunge'],
  ex_leg_curl: ['Leg Curl', 'Nordic Curl', 'Seated Leg Curl'],
  ex_calf_raise: ['Calf Raise', 'Single-leg Calf Raise', 'Donkey Calf Raise'],
  ex_barbell_row: ['Barbell Row', 'Chest-supported Row', 'Dumbbell Row'],
  ex_incline_bench: ['Incline Bench Press', 'Incline Dumbbell Press', 'Smith Incline Press'],
  ex_lateral_raise: ['Lateral Raises', 'Cable Lateral Raise', 'Machine Lateral Raise'],
  ex_cable_row: ['Cable Row', 'Seal Row', 'T-bar Row'],
  ex_hammer_curl: ['Hammer Curls', 'Cross-body Hammer Curl', 'Rope Hammer Curl'],
  ex_skull_crusher: ['Skull Crushers', 'Overhead Triceps Extension', 'Cable Triceps Extension'],
  ex_deadlift: ['Deadlift', 'Trap Bar Deadlift', 'Deficit Deadlift'],
  ex_front_squat: ['Front Squat', 'Leg Press', 'Goblet Squat'],
  ex_hip_thrust: ['Hip Thrust', 'Glute Bridge', 'Smith Hip Thrust'],
  ex_leg_extension: ['Leg Extension', 'Sissy Squat', 'Spanish Squat'],
  ex_seated_calf_raise: ['Seated Calf Raise', 'Leg Press Calf Raise', 'Standing Calf Raise'],
  ex_biceps_curl: ['Biceps Curl', 'Barbell Curl', 'Preacher Curl', 'Concentration Curl'],
  ex_triceps_pushdown: ['Triceps Pushdown', 'Rope Pushdown', 'Straight Bar Pushdown', 'V-Bar Pushdown'],
}

function normalizeVariant(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getCatalogExerciseVariants(exerciseId: string): string[] {
  return VARIANT_CATALOG[exerciseId] ?? []
}

export function getExerciseVariants(exerciseId: string, currentName: string): string[] {
  const variants = getCatalogExerciseVariants(exerciseId)
  const withCurrent = [currentName, ...variants]
  return [...new Set(withCurrent)]
}

export function isCustomExerciseVariant(exerciseId: string, exerciseName: string): boolean {
  const normalizedName = normalizeVariant(exerciseName)
  if (!normalizedName) {
    return false
  }

  const knownVariants = getCatalogExerciseVariants(exerciseId)
  return !knownVariants.some((variant) => normalizeVariant(variant) === normalizedName)
}

export function getAllCatalogExerciseNames(): string[] {
  const names = new Set<string>()
  for (const variants of Object.values(VARIANT_CATALOG)) {
    for (const variant of variants) {
      const trimmed = variant.trim()
      if (trimmed) {
        names.add(trimmed)
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b))
}

export function getCatalogExerciseIdByName(exerciseName: string): string | null {
  const normalized = normalizeVariant(exerciseName)
  if (!normalized) {
    return null
  }

  for (const [exerciseId, variants] of Object.entries(VARIANT_CATALOG)) {
    for (const variant of variants) {
      if (normalizeVariant(variant) === normalized) {
        return exerciseId
      }
    }
  }

  return null
}
