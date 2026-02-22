import { defaultExercisesData } from './defaultExercisesData'

const VARIANT_CATALOG: Record<string, string[]> = Object.fromEntries(
  Object.entries(defaultExercisesData).map(([exerciseId, entry]) => {
    const canonicalName = typeof entry?.name === 'string' ? entry.name.trim() : ''
    return [exerciseId, canonicalName ? [canonicalName] : []]
  }),
)


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

  if (VARIANT_CATALOG[exerciseId]?.length) {
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
