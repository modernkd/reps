import type { PlanDay } from './types'

export function inferWorkoutTypeFromPlanDay(day: Pick<PlanDay, 'label'> | undefined): string {
  if (!day) {
    return 'lift'
  }

  const label = day.label.toLowerCase()
  if (label.includes('yoga')) {
    return 'yoga'
  }
  if (label.includes('run')) {
    return 'run'
  }
  if (label.includes('cardio')) {
    return 'cardio'
  }
  if (label.includes('mobility')) {
    return 'mobility'
  }
  return 'lift'
}
