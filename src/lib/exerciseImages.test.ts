import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getUploadedExerciseImage,
  normalizeExerciseName,
  resolveExerciseReferenceContent,
  resolveExerciseReferenceImage,
  saveUploadedExerciseImage,
} from './exerciseImages'

describe('exerciseImages', () => {
  let localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    // Mock localStorage for Node/Bun test environment
    localStorageMock = {}
    if (typeof window === 'undefined') {
      ;(globalThis as any).window = {
        localStorage: {
          getItem: (key: string) => localStorageMock[key] || null,
          setItem: (key: string, value: string) => {
            localStorageMock[key] = value
          },
          clear: () => {
            localStorageMock = {}
          },
        },
      }
    } else if (window.localStorage) {
      window.localStorage.clear()
    }
  })

  afterEach(() => {
    const globalWithExerciseFlag = globalThis as { __ALLOW_EXERCISE_DB_IN_TEST__?: boolean }
    globalWithExerciseFlag.__ALLOW_EXERCISE_DB_IN_TEST__ = undefined
    vi.restoreAllMocks()
    // Clean up window mock
    if (typeof (globalThis as any).window?.localStorage === 'object') {
      delete (globalThis as any).window
    }
  })

  it('normalizes exercise names for stable keys', () => {
    expect(normalizeExerciseName('  Bench   Press  ')).toBe('bench press')
  })

  it('stores and reads uploaded exercise images', () => {
    saveUploadedExerciseImage('Bench Press', 'data:image/png;base64,abc123')

    expect(getUploadedExerciseImage('bench press')).toBe('data:image/png;base64,abc123')
  })

  it('prefers uploaded image before remote lookup', async () => {
    saveUploadedExerciseImage('Bench Press', 'data:image/png;base64,abc123')
    const fetchMock = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as any)

    const result = await resolveExerciseReferenceImage('ex_bench_press', 'Bench Press')

    expect(result).toEqual({
      source: 'uploaded',
      url: 'data:image/png;base64,abc123',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })


  it('falls back to local fallback image for unknown exercises', async () => {
    // For exercises not in defaultExercisesData and not found in remote DB,
    // the system falls back to a local image based on the exercise ID
    const result = await resolveExerciseReferenceContent(
      'custom_exercise_test',
      'Unknown Custom Exercise',
    )

    expect(result).toEqual({
      source: 'db',
      images: ['/images/exercises/custom_exercise_test_0.webp'],
      instructions: [],
    })
  })
})
