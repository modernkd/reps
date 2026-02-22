import { describe, expect, it } from 'vitest'

import {
  getCalendarMonthModel,
  getExerciseProgressSummaries,
  getLatestWeightByExerciseName,
  getRunProgressSeries,
  getStrengthExerciseNames,
  getStrengthProgressSeries,
  getWeeklyTrendSeries,
  getWorkoutsByDateRange,
} from './selectors'

const workouts = [
  {
    id: 'w1',
    date: '2026-02-02',
    type: 'lift',
    durationMin: 45,
    createdAt: '2026-02-02T08:00:00.000Z',
    updatedAt: '2026-02-02T08:00:00.000Z',
    sessionSummary: {
      startedAt: '2026-02-02T08:00:00.000Z',
      endedAt: '2026-02-02T08:45:00.000Z',
      totalDurationMin: 45,
      setLogs: [
        {
          exerciseId: 'e1',
          exerciseName: 'Bench Press',
          setIndex: 0,
          actualReps: 5,
          weightKg: 100,
          restSecUsed: 120,
        },
        {
          exerciseId: 'e1',
          exerciseName: 'Bench Press',
          setIndex: 1,
          actualReps: 5,
          weightKg: 105,
          restSecUsed: 120,
        },
      ],
    },
  },
  {
    id: 'w2',
    date: '2026-02-05',
    type: 'run',
    durationMin: 30,
    distanceKm: 5,
    createdAt: '2026-02-05T08:00:00.000Z',
    updatedAt: '2026-02-05T08:00:00.000Z',
    sessionSummary: {
      startedAt: '2026-02-05T08:00:00.000Z',
      endedAt: '2026-02-05T08:30:00.000Z',
      totalDurationMin: 30,
      setLogs: [
        { exerciseId: 'e2', setIndex: 0, actualReps: 1, weightKg: 70, restSecUsed: 60 },
      ],
    },
  },
  {
    id: 'w3',
    date: '2026-02-10',
    type: 'lift',
    durationMin: 60,
    createdAt: '2026-02-10T08:00:00.000Z',
    updatedAt: '2026-02-10T08:00:00.000Z',
    sessionSummary: {
      startedAt: '2026-02-10T08:00:00.000Z',
      endedAt: '2026-02-10T09:00:00.000Z',
      totalDurationMin: 60,
      setLogs: [
        {
          exerciseId: 'e3',
          exerciseName: 'Bench Press',
          setIndex: 0,
          actualReps: 3,
          weightKg: 120,
          restSecUsed: 150,
        },
      ],
    },
  },
]

describe('selectors', () => {
  it('filters workouts by date and type', () => {
    const result = getWorkoutsByDateRange({
      workouts,
      from: '2026-02-01',
      to: '2026-02-28',
      typeIds: ['lift'],
    })

    expect(result).toHaveLength(2)
    expect(result.every((item) => item.type === 'lift')).toBe(true)
  })

  it('builds calendar month model with workout indicators', () => {
    const model = getCalendarMonthModel({
      month: '2026-02',
      workouts,
      sessions: [],
      typeIds: [],
    })

    const matchingDay = model.find((day) => day.date === '2026-02-02')
    expect(matchingDay?.workouts).toHaveLength(1)
  })

  it('aggregates weekly trend series', () => {
    const series = getWeeklyTrendSeries({
      workouts,
      month: '2026-02',
      typeIds: [],
    })

    expect(series.points.length).toBeGreaterThan(4)

    const firstWorkoutWeek = series.points.find((point) => point.weekStart === '2026-02-02')
    expect(firstWorkoutWeek?.workoutsPerWeek).toBe(2)
    expect(firstWorkoutWeek?.totalDurationPerWeek).toBe(75)
    expect(firstWorkoutWeek?.avgWeightKg).toBe(91.7)
  })

  it('filters average weight trend by workout type', () => {
    const liftOnly = getWeeklyTrendSeries({
      workouts,
      month: '2026-02',
      typeIds: ['lift'],
    })

    const runOnly = getWeeklyTrendSeries({
      workouts,
      month: '2026-02',
      typeIds: ['run'],
    })

    const liftWeek = liftOnly.points.find((point) => point.weekStart === '2026-02-02')
    const runWeek = runOnly.points.find((point) => point.weekStart === '2026-02-02')

    expect(liftWeek?.avgWeightKg).toBe(102.5)
    expect(runWeek?.avgWeightKg).toBe(70)
  })

  it('builds strength performance series for a specific exercise', () => {
    const names = getStrengthExerciseNames({ workouts, typeId: 'lift' })
    expect(names).toContain('Bench Press')

    const strengthSeries = getStrengthProgressSeries({
      workouts,
      typeId: 'lift',
      exerciseName: 'Bench Press',
    })

    expect(strengthSeries).toEqual([
      { date: '2026-02-02', value: 105 },
      { date: '2026-02-10', value: 120 },
    ])
  })

  it('builds run pace and speed series', () => {
    const paceSeries = getRunProgressSeries({
      workouts,
      typeId: 'run',
      metric: 'pace',
    })
    const speedSeries = getRunProgressSeries({
      workouts,
      typeId: 'run',
      metric: 'speed',
    })

    expect(paceSeries).toEqual([{ date: '2026-02-05', value: 6 }])
    expect(speedSeries).toEqual([{ date: '2026-02-05', value: 10 }])
  })

  it('derives latest logged weight per exercise name from latest completed session', () => {
    const latest = getLatestWeightByExerciseName(workouts)

    expect(latest['bench press']).toBe(120)
    expect(latest['e2']).toBe(70)
  })

  it('builds exercise progress summaries ordered by latest log date', () => {
    const summaries = getExerciseProgressSummaries({ workouts })
    const bench = summaries.find((entry) => entry.key === 'bench press')

    expect(bench).toBeDefined()
    expect(bench?.totalLogs).toBe(2)
    expect(bench?.lastRecordedAt).toBe('2026-02-10')
    expect(bench?.logs[0]).toEqual({ date: '2026-02-10', weightKg: 120, setsLogged: 1 })
    expect(bench?.weightPoints.at(-1)).toEqual({ date: '2026-02-10', value: 120 })
  })

  it('applies workout-type filtering to exercise progress summaries', () => {
    const summaries = getExerciseProgressSummaries({ workouts, typeIds: ['run'] })

    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.key).toBe('e2')
    expect(summaries[0]?.lastWeightKg).toBe(70)
  })

  it('includes available exercises that have never been logged', () => {
    const summaries = getExerciseProgressSummaries({
      workouts,
      availableExerciseNames: ['Bench Press', 'Lateral Raises'],
    })

    const lateralRaises = summaries.find((entry) => entry.key === 'lateral raises')
    expect(lateralRaises).toBeDefined()
    expect(lateralRaises?.totalLogs).toBe(0)
    expect(lateralRaises?.lastRecordedAt).toBeNull()
  })
})
