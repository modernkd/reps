const CUSTOM_IMAGE_STORAGE_KEY = 'workout-tracker.custom-exercise-images.v1'

const EXERCISE_IMAGE_QUERY_BY_ID: Record<string, string> = {
  ex_pullups: 'pull up exercise',
  ex_bench_press: 'bench press exercise',
  ex_overhead_press: 'overhead press exercise',
  ex_incline_db_press: 'incline dumbbell press exercise',
  ex_back_squat: 'back squat exercise',
  ex_rdl: 'romanian deadlift exercise',
  ex_lunges: 'walking lunge exercise',
  ex_leg_curl: 'leg curl exercise',
  ex_calf_raise: 'standing calf raise exercise',
  ex_barbell_row: 'barbell row exercise',
  ex_incline_bench: 'incline bench press exercise',
  ex_lateral_raise: 'lateral raise exercise',
  ex_cable_row: 'seated cable row exercise',
  ex_hammer_curl: 'hammer curl exercise',
  ex_skull_crusher: 'skull crusher exercise',
  ex_deadlift: 'deadlift exercise',
  ex_front_squat: 'front squat exercise',
  ex_hip_thrust: 'hip thrust exercise',
  ex_leg_extension: 'leg extension machine exercise',
  ex_seated_calf_raise: 'seated calf raise exercise',
}

const commonsCache = new Map<string, string | null>()

export type ExerciseReferenceImage = {
  url: string
  source: 'uploaded' | 'commons'
}

type StoredCustomExerciseImages = Record<string, string>

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function readCustomImageStore(): StoredCustomExerciseImages {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_IMAGE_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return parsed as StoredCustomExerciseImages
  } catch {
    return {}
  }
}

function writeCustomImageStore(store: StoredCustomExerciseImages): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CUSTOM_IMAGE_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Ignore failed persistence in private mode / restricted contexts.
  }
}

export function getUploadedExerciseImage(exerciseName: string): string | undefined {
  const key = normalizeExerciseName(exerciseName)
  if (!key) {
    return undefined
  }

  const store = readCustomImageStore()
  return store[key]
}

export function saveUploadedExerciseImage(exerciseName: string, imageUrl: string): void {
  const key = normalizeExerciseName(exerciseName)
  if (!key || !imageUrl) {
    return
  }

  const next = readCustomImageStore()
  next[key] = imageUrl
  writeCustomImageStore(next)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read image file.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image file.'))
    reader.readAsDataURL(file)
  })
}

function buildCommonsQuery(searchTerm: string): URL {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrnamespace', '6')
  url.searchParams.set('gsrsearch', `${searchTerm} workout form`)
  url.searchParams.set('gsrlimit', '1')
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url')
  url.searchParams.set('iiurlwidth', '800')
  return url
}

async function fetchCommonsImage(searchTerm: string): Promise<string | undefined> {
  if (typeof fetch !== 'function') {
    return undefined
  }

  const normalizedSearch = normalizeExerciseName(searchTerm)
  if (!normalizedSearch) {
    return undefined
  }

  if (commonsCache.has(normalizedSearch)) {
    return commonsCache.get(normalizedSearch) ?? undefined
  }

  try {
    const response = await fetch(buildCommonsQuery(normalizedSearch).toString())
    if (!response.ok) {
      commonsCache.set(normalizedSearch, null)
      return undefined
    }

    const payload = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            imageinfo?: Array<{
              thumburl?: string
              url?: string
            }>
          }
        >
      }
    }

    const pages = payload.query?.pages ? Object.values(payload.query.pages) : []
    const imageInfo = pages[0]?.imageinfo?.[0]
    const imageUrl = imageInfo?.thumburl ?? imageInfo?.url

    commonsCache.set(normalizedSearch, imageUrl ?? null)
    return imageUrl
  } catch {
    commonsCache.set(normalizedSearch, null)
    return undefined
  }
}

export async function resolveExerciseReferenceImage(
  exerciseId: string,
  exerciseName: string,
): Promise<ExerciseReferenceImage | undefined> {
  const uploaded = getUploadedExerciseImage(exerciseName)
  if (uploaded) {
    return { url: uploaded, source: 'uploaded' }
  }

  const queries = [
    EXERCISE_IMAGE_QUERY_BY_ID[exerciseId],
    exerciseName,
    `${exerciseName} gym`,
  ].filter((item): item is string => Boolean(item))

  for (const query of queries) {
    const commonsImage = await fetchCommonsImage(query)
    if (commonsImage) {
      return { url: commonsImage, source: 'commons' }
    }
  }

  return undefined
}
