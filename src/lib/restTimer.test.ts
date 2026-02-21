import { describe, expect, it } from 'vitest'

import {
  addGuidedRestIncrement,
  GUIDED_REST_DEFAULT_SEC,
  GUIDED_REST_INCREMENT_SEC,
} from './restTimer'

describe('restTimer', () => {
  it('uses a 30 second guided default rest duration', () => {
    expect(GUIDED_REST_DEFAULT_SEC).toBe(30)
  })

  it('adds 30 second increments repeatedly', () => {
    expect(GUIDED_REST_INCREMENT_SEC).toBe(30)
    expect(addGuidedRestIncrement(0)).toBe(30)
    expect(addGuidedRestIncrement(30)).toBe(60)
    expect(addGuidedRestIncrement(60)).toBe(90)
  })
})
