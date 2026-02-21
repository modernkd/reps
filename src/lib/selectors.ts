import {
  compareAsc,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subMonths,
} from 'date-fns'

import {
  isDateInMonth,
  monthGridDates,
  toDateIso,
  toMonthIso,
  DATE_FORMAT,
} from './date'
import type {
  CalendarDayModel,
  ProgressPoint,
  ScheduledSession,
  ScheduledSessionStatus,
  WeeklyTrendSeries,
  Workout,
} from './types'

export type DateRangeInput = {
  from: string
  to: string
}

function fallbackExerciseName(exerciseId: string): string {
  return exerciseId
    .replace(/^ex_/, '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getWorkoutsByDateRange(input: {
  workouts: Workout[]
  from: string
  to: string
  typeIds?: string[]
}): Workout[] {
  const { workouts, from, to, typeIds } = input
  const activeTypes = typeIds?.length ? new Set(typeIds) : null

  return workouts
    .filter((workout) => workout.date >= from && workout.date <= to)
    .filter((workout) => (activeTypes ? activeTypes.has(workout.type) : true))
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
}

export function getScheduledSessions(input: {
  sessions: ScheduledSession[]
  from: string
  to: string
  status?: ScheduledSessionStatus
}): ScheduledSession[] {
  return input.sessions
    .filter((session) => session.date >= input.from && session.date <= input.to)
    .filter((session) => (input.status ? session.status === input.status : true))
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
}

export function monthRange(month: string): DateRangeInput {
  const monthStart = parseISO(`${month}-01`)
  const from = toDateIso(startOfWeek(monthStart, { weekStartsOn: 1 }))
  const to = toDateIso(endOfWeek(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0), { weekStartsOn: 1 }))

  return { from, to }
}

export function getCalendarMonthModel(input: {
  month: string
  workouts: Workout[]
  sessions: ScheduledSession[]
  typeIds?: string[]
}): CalendarDayModel[] {
  const { month, workouts, sessions, typeIds } = input
  const days = monthGridDates(month)
  const activeTypes = typeIds?.length ? new Set(typeIds) : null

  return days.map((day) => {
    const iso = toDateIso(day)

    const dayWorkouts = workouts.filter((workout) => {
      if (workout.date !== iso) {
        return false
      }

      return activeTypes ? activeTypes.has(workout.type) : true
    })

    const daySessions = sessions.filter((session) => session.date === iso)

    return {
      date: iso,
      inCurrentMonth: isDateInMonth(day, month),
      workouts: dayWorkouts,
      sessions: daySessions,
    }
  })
}

export function getWeeklyTrendSeries(input: {
  workouts: Workout[]
  month: string
  typeIds?: string[]
}): WeeklyTrendSeries {
  const end = parseISO(`${input.month}-01`)
  const from = startOfWeek(subMonths(end, 2), { weekStartsOn: 1 })
  const to = endOfWeek(new Date(end.getFullYear(), end.getMonth() + 1, 0), {
    weekStartsOn: 1,
  })

  const activeTypes = input.typeIds?.length ? new Set(input.typeIds) : null
  const buckets = new Map<
    string,
    {
      workoutsPerWeek: number
      totalDurationPerWeek: number
      totalWeightKg: number
      weightEntries: number
    }
  >()

  let cursor = from
  while (cursor <= to) {
    const key = format(startOfWeek(cursor, { weekStartsOn: 1 }), DATE_FORMAT)
    if (!buckets.has(key)) {
      buckets.set(key, {
        workoutsPerWeek: 0,
        totalDurationPerWeek: 0,
        totalWeightKg: 0,
        weightEntries: 0,
      })
    }
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  for (const workout of input.workouts) {
    if (activeTypes && !activeTypes.has(workout.type)) {
      continue
    }

    const date = parseISO(workout.date)
    if (date < from || date > to) {
      continue
    }

    const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), DATE_FORMAT)
    const bucket = buckets.get(weekStart)
    if (!bucket) {
      continue
    }

    bucket.workoutsPerWeek += 1
    bucket.totalDurationPerWeek += workout.durationMin
    const setWeights = workout.sessionSummary?.setLogs
      .map((setLog) => setLog.weightKg)
      .filter((value): value is number => typeof value === 'number')

    if (setWeights && setWeights.length > 0) {
      bucket.totalWeightKg += setWeights.reduce((acc, value) => acc + value, 0)
      bucket.weightEntries += setWeights.length
    }
  }

  const points = [...buckets.entries()]
    .map(([weekStart, values]) => ({
      weekStart,
      workoutsPerWeek: values.workoutsPerWeek,
      totalDurationPerWeek: values.totalDurationPerWeek,
      avgWeightKg:
        values.weightEntries > 0
          ? Number((values.totalWeightKg / values.weightEntries).toFixed(1))
          : null,
    }))
    .sort((a, b) => compareAsc(parseISO(a.weekStart), parseISO(b.weekStart)))

  return { points }
}

export function getDefaultMonth(workouts: Workout[]): string {
  const latestWorkout = [...workouts]
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
    .at(-1)

  if (latestWorkout) {
    return toMonthIso(parseISO(latestWorkout.date))
  }

  return toMonthIso(new Date())
}

export function getStrengthExerciseNames(input: {
  workouts: Workout[]
  typeId: string
}): string[] {
  const names = new Set<string>()

  for (const workout of input.workouts) {
    if (workout.type !== input.typeId) {
      continue
    }

    for (const setLog of workout.sessionSummary?.setLogs ?? []) {
      names.add(setLog.exerciseName ?? fallbackExerciseName(setLog.exerciseId))
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b))
}

export function getStrengthProgressSeries(input: {
  workouts: Workout[]
  typeId: string
  exerciseName: string
}): ProgressPoint[] {
  return input.workouts
    .filter((workout) => workout.type === input.typeId)
    .flatMap((workout) => {
      const matchingSets = (workout.sessionSummary?.setLogs ?? []).filter(
        (setLog) =>
          (setLog.exerciseName ?? fallbackExerciseName(setLog.exerciseId)).toLowerCase() ===
            input.exerciseName.toLowerCase() &&
          typeof setLog.weightKg === 'number',
      )

      if (matchingSets.length === 0) {
        return []
      }

      const bestSet = Math.max(...matchingSets.map((setLog) => setLog.weightKg ?? 0))
      return [{ date: workout.date, value: Number(bestSet.toFixed(1)) }]
    })
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
}

export function getRunProgressSeries(input: {
  workouts: Workout[]
  typeId: string
  metric: 'pace' | 'speed'
}): ProgressPoint[] {
  return input.workouts
    .filter((workout) => workout.type === input.typeId)
    .filter((workout) => typeof workout.distanceKm === 'number' && workout.distanceKm > 0)
    .map((workout) => {
      const distance = workout.distanceKm as number
      const pace = workout.durationMin / distance
      const speed = distance / (workout.durationMin / 60)

      return {
        date: workout.date,
        value: Number((input.metric === 'pace' ? pace : speed).toFixed(2)),
      }
    })
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
}
