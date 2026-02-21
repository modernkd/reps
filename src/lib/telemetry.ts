type TelemetryEvent = {
  event: string
  payload?: Record<string, unknown>
  at: string
}

const STORAGE_KEY = 'workout-tracker.telemetry.v1'

function readEvents(): TelemetryEvent[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as TelemetryEvent[]
  } catch {
    return []
  }
}

export function trackEvent(event: string, payload?: Record<string, unknown>): void {
  const entry: TelemetryEvent = {
    event,
    payload,
    at: new Date().toISOString(),
  }

  if (typeof window !== 'undefined') {
    const next = [...readEvents(), entry].slice(-200)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[telemetry]', entry)
  }
}
