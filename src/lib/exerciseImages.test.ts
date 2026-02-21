import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getUploadedExerciseImage,
  normalizeExerciseName,
  resolveExerciseReferenceImage,
  saveUploadedExerciseImage,
} from './exerciseImages'

describe('exerciseImages', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolveExerciseReferenceImage('ex_bench_press', 'Bench Press')

    expect(result).toEqual({
      source: 'uploaded',
      url: 'data:image/png;base64,abc123',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches and caches commons images', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            '1': {
              imageinfo: [{ thumburl: 'https://images.example/custom-snatch.jpg' }],
            },
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await resolveExerciseReferenceImage('custom_cache_unit', 'Unit Test Snatch')
    const second = await resolveExerciseReferenceImage('custom_cache_unit', 'Unit Test Snatch')

    expect(first).toEqual({
      source: 'commons',
      url: 'https://images.example/custom-snatch.jpg',
    })
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
