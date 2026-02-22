import { defaultExercisesData } from './defaultExercisesData'

export type ExerciseDbEntry = {
  id: string
  name: string
  category?: string
  equipment?: string
  force?: string
  level?: string
  mechanic?: string
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  images?: string[]
  instructions?: string[]
}

type ExerciseDbIndexes = {
  byId: Map<string, ExerciseDbEntry>
  byName: Map<string, ExerciseDbEntry>
  byNormalizedName: Map<string, ExerciseDbEntry>
  byPrimaryMuscle: Map<string, ExerciseDbEntry[]>
  byEquipment: Map<string, ExerciseDbEntry[]>
  byLevel: Map<string, ExerciseDbEntry[]>
  byCategory: Map<string, ExerciseDbEntry[]>
}

// In-memory cache
let remoteExerciseDbCache: null | ExerciseDbEntry[] = null
let localExerciseDbCache: null | ExerciseDbEntry[] = null
let indexesCache: null | ExerciseDbIndexes = null

function normalizeString(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Fetch the remote free-exercise-db JSON
 */
async function fetchRemoteExerciseDb(): Promise<ExerciseDbEntry[] | null> {
  if (remoteExerciseDbCache) {
    return remoteExerciseDbCache
  }

  const allowTestDbAccess =
    typeof globalThis !== 'undefined' &&
    (globalThis as { __ALLOW_EXERCISE_DB_IN_TEST__?: boolean })
      .__ALLOW_EXERCISE_DB_IN_TEST__ === true

  if (
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { MODE?: string } }).env?.MODE === 'test')
  ) {
    if (!allowTestDbAccess) {
      return null
    }
  }

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',
    )
    if (!response.ok) {
      return null
    }
    const payload = await response.json()
    if (!Array.isArray(payload)) {
      return null
    }

    remoteExerciseDbCache = payload as ExerciseDbEntry[]
    return remoteExerciseDbCache
  } catch {
    return null
  }
}

/**
 * Load local pre-seeded exercises from defaultExercisesData
 */
function loadLocalExerciseDb(): ExerciseDbEntry[] {
  if (localExerciseDbCache) {
    return localExerciseDbCache
  }

  const entries: ExerciseDbEntry[] = []
  for (const [key, value] of Object.entries(defaultExercisesData)) {
    entries.push({
      id: key, // Use the key as ID (matches template exercise IDs)
      name: value.name || key,
      category: value.category,
      equipment: value.equipment,
      force: value.force,
      level: value.level,
      mechanic: value.mechanic,
      primaryMuscles: value.primaryMuscles,
      secondaryMuscles: value.secondaryMuscles,
      images: value.images,
      instructions: value.instructions,
    })
  }

  localExerciseDbCache = entries
  return entries
}

/**
 * Get combined exercise database (local + remote)
 */
async function getCombinedExerciseDb(): Promise<ExerciseDbEntry[]> {
  const local = loadLocalExerciseDb()
  const remote = await fetchRemoteExerciseDb()

  if (!remote) {
    return local
  }

  // Merge: local exercises take priority over remote
  const localNameSet = new Set(local.map((e) => normalizeString(e.name)))
  const combined = [...local]

  for (const remoteEntry of remote) {
    const normalizedName = normalizeString(remoteEntry.name)
    if (!localNameSet.has(normalizedName)) {
      combined.push(remoteEntry)
    }
  }

  return combined
}

/**
 * Build normalized indexes for fast lookups
 */
function buildIndexes(exercises: ExerciseDbEntry[]): ExerciseDbIndexes {
  const byId = new Map<string, ExerciseDbEntry>()
  const byName = new Map<string, ExerciseDbEntry>()
  const byNormalizedName = new Map<string, ExerciseDbEntry>()
  const byPrimaryMuscle = new Map<string, ExerciseDbEntry[]>()
  const byEquipment = new Map<string, ExerciseDbEntry[]>()
  const byLevel = new Map<string, ExerciseDbEntry[]>()
  const byCategory = new Map<string, ExerciseDbEntry[]>()

  for (const exercise of exercises) {
    // Index by ID
    byId.set(exercise.id, exercise)

    // Index by exact name
    byName.set(exercise.name, exercise)

    // Index by normalized name
    const normalizedName = normalizeString(exercise.name)
    byNormalizedName.set(normalizedName, exercise)

    // Index by primary muscles
    if (exercise.primaryMuscles) {
      for (const muscle of exercise.primaryMuscles) {
        const key = normalizeString(muscle)
        if (!byPrimaryMuscle.has(key)) {
          byPrimaryMuscle.set(key, [])
        }
        byPrimaryMuscle.get(key)!.push(exercise)
      }
    }

    // Index by equipment
    if (exercise.equipment) {
      const key = normalizeString(exercise.equipment)
      if (!byEquipment.has(key)) {
        byEquipment.set(key, [])
      }
      byEquipment.get(key)!.push(exercise)
    }

    // Index by level
    if (exercise.level) {
      const key = normalizeString(exercise.level)
      if (!byLevel.has(key)) {
        byLevel.set(key, [])
      }
      byLevel.get(key)!.push(exercise)
    }

    // Index by category
    if (exercise.category) {
      const key = normalizeString(exercise.category)
      if (!byCategory.has(key)) {
        byCategory.set(key, [])
      }
      byCategory.get(key)!.push(exercise)
    }
  }

  return {
    byId,
    byName,
    byNormalizedName,
    byPrimaryMuscle,
    byEquipment,
    byLevel,
    byCategory,
  }
}

/**
 * Get or build indexes (lazy initialization)
 */
async function getIndexes(): Promise<ExerciseDbIndexes> {
  if (indexesCache) {
    return indexesCache
  }

  const exercises = await getCombinedExerciseDb()
  indexesCache = buildIndexes(exercises)
  return indexesCache
}

/**
 * Get exercise by exact or fuzzy name match
 */
export async function getExerciseByName(
  name: string,
): Promise<ExerciseDbEntry | undefined> {
  if (!name.trim()) {
    return undefined
  }

  const indexes = await getIndexes()
  const normalizedQuery = normalizeString(name)

  // Try ID match first
  const idMatch = indexes.byId.get(name)
  if (idMatch) {
    return idMatch
  }

  // Try exact name match
  const exactMatch = indexes.byName.get(name)
  if (exactMatch) {
    return exactMatch
  }

  // Try normalized name match
  const normalizedMatch = indexes.byNormalizedName.get(normalizedQuery)
  if (normalizedMatch) {
    return normalizedMatch
  }

  // Try fuzzy match (contains)
  for (const [normalizedName, exercise] of indexes.byNormalizedName.entries()) {
    if (
      normalizedName.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedName)
    ) {
      return exercise
    }
  }

  return undefined
}

/**
 * Search exercises by name, muscles, or equipment
 */
export async function searchExercises(query: string): Promise<ExerciseDbEntry[]> {
  if (!query.trim()) {
    return []
  }

  const indexes = await getIndexes()
  const normalizedQuery = normalizeString(query)
  const results = new Map<string, ExerciseDbEntry>()

  // Search by name (exact, prefix, substring)
  for (const [normalizedName, exercise] of indexes.byNormalizedName.entries()) {
    if (normalizedName === normalizedQuery) {
      // Exact match - highest priority
      results.set(exercise.id, exercise)
    } else if (normalizedName.startsWith(normalizedQuery)) {
      // Prefix match - high priority
      results.set(exercise.id, exercise)
    } else if (normalizedName.includes(normalizedQuery)) {
      // Substring match - medium priority
      results.set(exercise.id, exercise)
    }
  }

  // Search by primary muscles
  for (const [muscleName, exercises] of indexes.byPrimaryMuscle.entries()) {
    if (muscleName.includes(normalizedQuery) || normalizedQuery.includes(muscleName)) {
      for (const exercise of exercises) {
        results.set(exercise.id, exercise)
      }
    }
  }

  // Search by equipment
  for (const [equipmentName, exercises] of indexes.byEquipment.entries()) {
    if (
      equipmentName.includes(normalizedQuery) ||
      normalizedQuery.includes(equipmentName)
    ) {
      for (const exercise of exercises) {
        results.set(exercise.id, exercise)
      }
    }
  }

  return Array.from(results.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get exercises by primary muscle group
 */
export async function getExercisesByMuscle(
  muscle: string,
): Promise<ExerciseDbEntry[]> {
  const indexes = await getIndexes()
  const key = normalizeString(muscle)
  return indexes.byPrimaryMuscle.get(key) ?? []
}

/**
 * Get exercises by equipment type
 */
export async function getExercisesByEquipment(
  equipment: string,
): Promise<ExerciseDbEntry[]> {
  const indexes = await getIndexes()
  const key = normalizeString(equipment)
  return indexes.byEquipment.get(key) ?? []
}

/**
 * Get exercises by difficulty level
 */
export async function getExercisesByLevel(level: string): Promise<ExerciseDbEntry[]> {
  const indexes = await getIndexes()
  const key = normalizeString(level)
  return indexes.byLevel.get(key) ?? []
}

/**
 * Get exercises by category
 */
export async function getExercisesByCategory(
  category: string,
): Promise<ExerciseDbEntry[]> {
  const indexes = await getIndexes()
  const key = normalizeString(category)
  return indexes.byCategory.get(key) ?? []
}

/**
 * Get all exercise names (sorted)
 */
export async function getAllExerciseNames(): Promise<string[]> {
  const indexes = await getIndexes()
  return Array.from(indexes.byName.keys()).sort((a, b) => a.localeCompare(b))
}

/**
 * Get all unique muscle groups
 */
export async function getAllMuscleGroups(): Promise<string[]> {
  const indexes = await getIndexes()
  return Array.from(indexes.byPrimaryMuscle.keys()).sort((a, b) =>
    a.localeCompare(b),
  )
}

/**
 * Get all unique equipment types
 */
export async function getAllEquipmentTypes(): Promise<string[]> {
  const indexes = await getIndexes()
  return Array.from(indexes.byEquipment.keys()).sort((a, b) => a.localeCompare(b))
}

/**
 * Get all unique difficulty levels
 */
export async function getAllLevels(): Promise<string[]> {
  const indexes = await getIndexes()
  return Array.from(indexes.byLevel.keys()).sort((a, b) => a.localeCompare(b))
}
