export const GUIDED_REST_DEFAULT_SEC = 30
export const GUIDED_REST_INCREMENT_SEC = 30

export function addGuidedRestIncrement(seconds: number): number {
  return Math.max(0, seconds) + GUIDED_REST_INCREMENT_SEC
}
