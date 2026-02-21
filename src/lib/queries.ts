import {
  planDaysCollection,
  scheduledSessionsCollection,
  workoutsCollection,
} from './db'
import {
  getCalendarMonthModel as selectCalendarMonthModel,
  getScheduledSessions as selectScheduledSessions,
  getWeeklyTrendSeries as selectWeeklyTrendSeries,
  getWorkoutsByDateRange as selectWorkoutsByDateRange,
} from './selectors'

export function getWorkoutsByDateRange(input: {
  from: string
  to: string
  typeIds?: string[]
}) {
  return selectWorkoutsByDateRange({
    workouts: workoutsCollection.toArray,
    ...input,
  })
}

export function getCalendarMonthModel(input: {
  month: string
  typeIds?: string[]
}) {
  return selectCalendarMonthModel({
    month: input.month,
    workouts: workoutsCollection.toArray,
    sessions: scheduledSessionsCollection.toArray,
    typeIds: input.typeIds,
  })
}

export function getWeeklyTrendSeries(input: { month: string; typeIds?: string[] }) {
  return selectWeeklyTrendSeries({
    workouts: workoutsCollection.toArray,
    month: input.month,
    typeIds: input.typeIds,
  })
}

export function getScheduledSessions(input: {
  from: string
  to: string
  status?: 'planned' | 'in_progress' | 'completed' | 'skipped'
}) {
  return selectScheduledSessions({
    sessions: scheduledSessionsCollection.toArray,
    ...input,
  })
}

export function getPlanDayById(id: string) {
  return planDaysCollection.get(id)
}
