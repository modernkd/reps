import { useEffect, useMemo, useRef, useState } from 'react'

import {
  axisBottom,
  axisLeft,
  axisRight,
  bisector,
  curveMonotoneX,
  extent,
  format as d3Format,
  line,
  max,
  scaleLinear,
  scaleTime,
  select,
} from 'd3'
import { format, parseISO } from 'date-fns'
import gsap from 'gsap'

import {
  getRunProgressSeries,
  getStrengthExerciseNames,
  getStrengthProgressSeries,
} from '@/lib/selectors'
import type {
  ProgressPoint,
  WeeklyTrendPoint,
  WeeklyTrendSeries,
  Workout,
  WorkoutType,
} from '@/lib/types'
import { useReducedMotion } from '@/lib/useReducedMotion'

import styles from './styles/GraphView.module.css'

type GraphViewProps = {
  series: WeeklyTrendSeries
  workouts: Workout[]
  workoutTypes: WorkoutType[]
  selectedTypeIds: string[]
  onPointSelect: (weekStart: string) => void
}

type TooltipState = {
  x: number
  y: number
  point: WeeklyTrendPoint
}

const WIDTH = 900
const HEIGHT = 360
const WEIGHT_HEIGHT = 190
const PERFORMANCE_HEIGHT = 220
const MARGIN = { top: 18, right: 56, bottom: 34, left: 48 }

export function GraphView({
  series,
  workouts,
  workoutTypes,
  selectedTypeIds,
  onPointSelect,
}: GraphViewProps) {
  const reducedMotion = useReducedMotion()
  const axisBottomRef = useRef<SVGGElement | null>(null)
  const axisLeftRef = useRef<SVGGElement | null>(null)
  const axisRightRef = useRef<SVGGElement | null>(null)
  const weightAxisBottomRef = useRef<SVGGElement | null>(null)
  const weightAxisLeftRef = useRef<SVGGElement | null>(null)
  const perfAxisBottomRef = useRef<SVGGElement | null>(null)
  const perfAxisLeftRef = useRef<SVGGElement | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [focusTypeId, setFocusTypeId] = useState<string>('')
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [runMetric, setRunMetric] = useState<'pace' | 'speed'>('pace')

  const points = useMemo(
    () =>
      [...series.points].sort(
        (a, b) => parseISO(a.weekStart).getTime() - parseISO(b.weekStart).getTime(),
      ),
    [series.points],
  )

  const drawableWidth = WIDTH - MARGIN.left - MARGIN.right
  const drawableHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const parsedDates = points.map((point) => parseISO(point.weekStart))
  const dateExtent = extent(parsedDates)
  const xDomain: [Date, Date] =
    dateExtent[0] && dateExtent[1]
      ? [dateExtent[0], dateExtent[1]]
      : [new Date(), new Date()]

  const maxFrequency = max(points, (point) => point.workoutsPerWeek) ?? 1
  const maxDuration = max(points, (point) => point.totalDurationPerWeek) ?? 1
  const weightPoints = points.filter((point) => point.avgWeightKg !== null)
  const maxWeight = max(weightPoints, (point) => point.avgWeightKg ?? 0) ?? 1

  const xScale = useMemo(
    () => scaleTime().domain(xDomain).range([0, drawableWidth]),
    [xDomain, drawableWidth],
  )

  const yFrequency = useMemo(
    () =>
      scaleLinear().domain([0, Math.max(1, maxFrequency)]).nice().range([drawableHeight, 0]),
    [drawableHeight, maxFrequency],
  )

  const yDuration = useMemo(
    () =>
      scaleLinear().domain([0, Math.max(1, maxDuration)]).nice().range([drawableHeight, 0]),
    [drawableHeight, maxDuration],
  )

  const weightDrawableHeight = WEIGHT_HEIGHT - MARGIN.top - MARGIN.bottom
  const yWeight = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(1, maxWeight)])
        .nice()
        .range([weightDrawableHeight, 0]),
    [maxWeight, weightDrawableHeight],
  )

  const frequencyPath = useMemo(() => {
    const shape = line<WeeklyTrendPoint>()
      .x((point) => xScale(parseISO(point.weekStart)))
      .y((point) => yFrequency(point.workoutsPerWeek))
      .curve(curveMonotoneX)
    return shape(points) ?? ''
  }, [points, xScale, yFrequency])

  const durationPath = useMemo(() => {
    const shape = line<WeeklyTrendPoint>()
      .x((point) => xScale(parseISO(point.weekStart)))
      .y((point) => yDuration(point.totalDurationPerWeek))
      .curve(curveMonotoneX)
    return shape(points) ?? ''
  }, [points, xScale, yDuration])

  const weightPath = useMemo(() => {
    const shape = line<WeeklyTrendPoint>()
      .defined((point) => point.avgWeightKg !== null)
      .x((point) => xScale(parseISO(point.weekStart)))
      .y((point) => yWeight(point.avgWeightKg ?? 0))
      .curve(curveMonotoneX)
    return shape(points) ?? ''
  }, [points, xScale, yWeight])

  const scopedWorkouts = useMemo(() => {
    const activeTypes = selectedTypeIds.length > 0 ? new Set(selectedTypeIds) : null

    return workouts.filter((workout) =>
      activeTypes ? activeTypes.has(workout.type) : true,
    )
  }, [selectedTypeIds, workouts])

  const typeOptions = useMemo(() => {
    const present = new Set(scopedWorkouts.map((workout) => workout.type))
    return workoutTypes.filter((type) => present.has(type.id))
  }, [scopedWorkouts, workoutTypes])

  useEffect(() => {
    const fallback = typeOptions[0]?.id ?? ''

    if (!focusTypeId || !typeOptions.some((type) => type.id === focusTypeId)) {
      setFocusTypeId(fallback)
    }
  }, [focusTypeId, typeOptions])

  const isRunLike = focusTypeId === 'run' || focusTypeId === 'cardio'

  const strengthExerciseNames = useMemo(
    () =>
      focusTypeId
        ? getStrengthExerciseNames({ workouts: scopedWorkouts, typeId: focusTypeId })
        : [],
    [focusTypeId, scopedWorkouts],
  )

  useEffect(() => {
    const fallback = strengthExerciseNames[0] ?? ''

    if (isRunLike) {
      setSelectedExercise('')
      return
    }

    if (!selectedExercise || !strengthExerciseNames.includes(selectedExercise)) {
      setSelectedExercise(fallback)
    }
  }, [isRunLike, selectedExercise, strengthExerciseNames])

  const performancePoints = useMemo<ProgressPoint[]>(() => {
    if (!focusTypeId) {
      return []
    }

    if (isRunLike) {
      return getRunProgressSeries({
        workouts: scopedWorkouts,
        typeId: focusTypeId,
        metric: runMetric,
      })
    }

    if (!selectedExercise) {
      return []
    }

    return getStrengthProgressSeries({
      workouts: scopedWorkouts,
      typeId: focusTypeId,
      exerciseName: selectedExercise,
    })
  }, [focusTypeId, isRunLike, runMetric, scopedWorkouts, selectedExercise])

  const performanceYLabel = isRunLike
    ? runMetric === 'pace'
      ? 'Pace (min/km)'
      : 'Speed (km/h)'
    : 'Best set weight (kg)'

  const performanceTitle = isRunLike
    ? runMetric === 'pace'
      ? 'Run Pace Progress'
      : 'Run Speed Progress'
    : selectedExercise
      ? `${selectedExercise} Progress`
      : 'Exercise Progress'

  const performanceDrawableHeight = PERFORMANCE_HEIGHT - MARGIN.top - MARGIN.bottom
  const performanceDateExtent = extent(
    performancePoints.map((point) => parseISO(point.date)),
  )

  const performanceXDomain: [Date, Date] = useMemo(() => {
    const start = performanceDateExtent[0]
    const end = performanceDateExtent[1]

    if (!start || !end) {
      const now = new Date()
      return [now, now]
    }

    if (start.getTime() === end.getTime()) {
      return [start, new Date(end.getTime() + 24 * 60 * 60 * 1000)]
    }

    return [start, end]
  }, [performanceDateExtent])

  const performanceXScale = useMemo(
    () => scaleTime().domain(performanceXDomain).range([0, drawableWidth]),
    [drawableWidth, performanceXDomain],
  )

  const performanceMax = max(performancePoints, (point) => point.value) ?? 1
  const performanceMin = Math.min(
    ...performancePoints.map((point) => point.value),
    0,
  )

  const performanceYScale = useMemo(
    () =>
      scaleLinear()
        .domain([performanceMin, Math.max(1, performanceMax)])
        .nice()
        .range([performanceDrawableHeight, 0]),
    [performanceDrawableHeight, performanceMax, performanceMin],
  )

  const performancePath = useMemo(() => {
    const shape = line<ProgressPoint>()
      .x((point) => performanceXScale(parseISO(point.date)))
      .y((point) => performanceYScale(point.value))
      .curve(curveMonotoneX)

    return shape(performancePoints) ?? ''
  }, [performancePoints, performanceXScale, performanceYScale])

  useEffect(() => {
    if (!axisBottomRef.current || !axisLeftRef.current || !axisRightRef.current) {
      return
    }

    const xAxis = axisBottom<Date>(xScale)
      .ticks(Math.min(8, points.length))
      .tickFormat((value) => format(value, 'MMM d'))

    const leftAxis = axisLeft(yFrequency).ticks(6)
    const rightAxis = axisRight(yDuration).ticks(6)

    select(axisBottomRef.current).call(xAxis)
    select(axisLeftRef.current).call(leftAxis)
    select(axisRightRef.current).call(rightAxis)
  }, [points.length, xScale, yDuration, yFrequency])

  useEffect(() => {
    if (!weightAxisBottomRef.current || !weightAxisLeftRef.current) {
      return
    }

    const xAxis = axisBottom<Date>(xScale)
      .ticks(Math.min(8, points.length))
      .tickFormat((value) => format(value, 'MMM d'))
    const yAxis = axisLeft(yWeight).ticks(4)

    select(weightAxisBottomRef.current).call(xAxis)
    select(weightAxisLeftRef.current).call(yAxis)
  }, [points.length, xScale, yWeight])

  useEffect(() => {
    if (!perfAxisBottomRef.current || !perfAxisLeftRef.current) {
      return
    }

    const xAxis = axisBottom<Date>(performanceXScale)
      .ticks(Math.min(8, Math.max(2, performancePoints.length)))
      .tickFormat((value) => format(value, 'MMM d'))
    const yAxis = axisLeft(performanceYScale).ticks(5)

    select(perfAxisBottomRef.current).call(xAxis)
    select(perfAxisLeftRef.current).call(yAxis)
  }, [performancePoints.length, performanceXScale, performanceYScale])

  useEffect(() => {
    if (!chartRef.current || reducedMotion) {
      return
    }

    const lines = chartRef.current.querySelectorAll('path[data-anim="line"]')
    const pointsNodes = chartRef.current.querySelectorAll('circle[data-anim="point"]')

    gsap.fromTo(
      lines,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
    )
    gsap.fromTo(
      pointsNodes,
      { opacity: 0, scale: 0.85 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.26,
        ease: 'power2.out',
        stagger: 0.015,
      },
    )
  }, [performancePoints, points, reducedMotion])

  const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    if (points.length === 0) {
      return
    }

    const target = event.currentTarget
    const bounds = target.getBoundingClientRect()
    const localX = event.clientX - bounds.left
    const domainX = xScale.invert(localX)

    const dateBisector = bisector<WeeklyTrendPoint, Date>((point) =>
      parseISO(point.weekStart),
    ).center
    const nearestIndex = dateBisector(points, domainX)
    const point = points[nearestIndex]

    if (!point) {
      return
    }

    setTooltip({
      x: MARGIN.left + xScale(parseISO(point.weekStart)),
      y: MARGIN.top + yFrequency(point.workoutsPerWeek),
      point,
    })
  }

  if (points.length === 0) {
    return (
      <section className={styles.empty} aria-label="Graph view empty state">
        <h3>No workout data yet</h3>
        <p>Log workouts to unlock weekly trend lines.</p>
      </section>
    )
  }

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h3>Weekly Workout Trends</h3>
        <p aria-live="polite">
          Frequency and total duration per ISO week. Hover points for details.
        </p>
      </header>

      <div className={styles.chartWrap} ref={chartRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.chart}
          role="img"
          aria-label="Line chart showing workouts per week and duration per week"
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            <g className={styles.gridLines}>
              {yFrequency.ticks(5).map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  x2={drawableWidth}
                  y1={yFrequency(tick)}
                  y2={yFrequency(tick)}
                />
              ))}
            </g>

            <path data-anim="line" d={durationPath} className={styles.durationPath} />
            <path data-anim="line" d={frequencyPath} className={styles.frequencyPath} />

            {points.map((point) => {
              const x = xScale(parseISO(point.weekStart))
              return (
                <g key={point.weekStart}>
                  <circle
                    data-anim="point"
                    className={styles.frequencyPoint}
                    cx={x}
                    cy={yFrequency(point.workoutsPerWeek)}
                    r={4.2}
                    onClick={() => onPointSelect(point.weekStart)}
                  />
                  <circle
                    data-anim="point"
                    className={styles.durationPoint}
                    cx={x}
                    cy={yDuration(point.totalDurationPerWeek)}
                    r={3.5}
                    onClick={() => onPointSelect(point.weekStart)}
                  />
                </g>
              )
            })}

            <g ref={axisBottomRef} transform={`translate(0, ${drawableHeight})`} />
            <g ref={axisLeftRef} />
            <g ref={axisRightRef} transform={`translate(${drawableWidth}, 0)`} />

            <rect
              x={0}
              y={0}
              width={drawableWidth}
              height={drawableHeight}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setTooltip(null)}
            />
          </g>
        </svg>

        {tooltip ? (
          <div
            className={styles.tooltip}
            style={{ left: tooltip.x, top: tooltip.y }}
            role="status"
            aria-live="polite"
          >
            <strong>{format(parseISO(tooltip.point.weekStart), 'MMM d')}</strong>
            <span>{tooltip.point.workoutsPerWeek} workouts</span>
            <span>{d3Format(',')(tooltip.point.totalDurationPerWeek)} min</span>
            {tooltip.point.avgWeightKg ? <span>{tooltip.point.avgWeightKg} kg avg</span> : null}
          </div>
        ) : null}
      </div>

      {weightPoints.length > 0 ? (
        <div className={styles.weightWrap}>
          <h4>Average Weight Progress (kg)</h4>
          <svg
            viewBox={`0 0 ${WIDTH} ${WEIGHT_HEIGHT}`}
            className={styles.chart}
            role="img"
            aria-label="Line chart showing average workout weight per week"
          >
            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              <g className={styles.gridLines}>
                {yWeight.ticks(4).map((tick) => (
                  <line
                    key={tick}
                    x1={0}
                    x2={drawableWidth}
                    y1={yWeight(tick)}
                    y2={yWeight(tick)}
                  />
                ))}
              </g>

              <path d={weightPath} data-anim="line" className={styles.weightPath} />

              {weightPoints.map((point) => (
                <circle
                  key={`weight_${point.weekStart}`}
                  data-anim="point"
                  className={styles.weightPoint}
                  cx={xScale(parseISO(point.weekStart))}
                  cy={yWeight(point.avgWeightKg ?? 0)}
                  r={3.8}
                />
              ))}

              <g ref={weightAxisBottomRef} transform={`translate(0, ${weightDrawableHeight})`} />
              <g ref={weightAxisLeftRef} />
            </g>
          </svg>
        </div>
      ) : (
        <p className={styles.weightHint}>
          Add weight values to sets to see weekly load progression.
        </p>
      )}

      <div className={styles.performanceWrap}>
        <div className={styles.performanceHeader}>
          <h4>Performance Over Time</h4>
          <div className={styles.performanceControls}>
            <label>
              Type
              <select
                value={focusTypeId}
                onChange={(event) => setFocusTypeId(event.target.value)}
              >
                {typeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>

            {isRunLike ? (
              <label>
                Metric
                <select
                  value={runMetric}
                  onChange={(event) =>
                    setRunMetric(event.target.value as 'pace' | 'speed')
                  }
                >
                  <option value="pace">Pace (min/km)</option>
                  <option value="speed">Speed (km/h)</option>
                </select>
              </label>
            ) : (
              <label>
                Exercise
                <select
                  value={selectedExercise}
                  onChange={(event) => setSelectedExercise(event.target.value)}
                >
                  {strengthExerciseNames.map((exerciseName) => (
                    <option key={exerciseName} value={exerciseName}>
                      {exerciseName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {performancePoints.length > 0 ? (
          <svg
            viewBox={`0 0 ${WIDTH} ${PERFORMANCE_HEIGHT}`}
            className={styles.chart}
            role="img"
            aria-label={`${performanceTitle} chart`}
          >
            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              <g className={styles.gridLines}>
                {performanceYScale.ticks(5).map((tick) => (
                  <line
                    key={tick}
                    x1={0}
                    x2={drawableWidth}
                    y1={performanceYScale(tick)}
                    y2={performanceYScale(tick)}
                  />
                ))}
              </g>

              <path
                d={performancePath}
                data-anim="line"
                className={styles.performancePath}
              />

              {performancePoints.map((point) => (
                <circle
                  key={`${point.date}_${point.value}`}
                  data-anim="point"
                  className={styles.performancePoint}
                  cx={performanceXScale(parseISO(point.date))}
                  cy={performanceYScale(point.value)}
                  r={3.8}
                />
              ))}

              <g
                ref={perfAxisBottomRef}
                transform={`translate(0, ${performanceDrawableHeight})`}
              />
              <g ref={perfAxisLeftRef} />
            </g>
          </svg>
        ) : (
          <p className={styles.weightHint}>
            {isRunLike
              ? 'Log run workouts with distance to track pace/speed progress.'
              : 'No set weight data for this exercise yet.'}
          </p>
        )}

        <p className={styles.metricLabel}>{performanceYLabel}</p>
      </div>
    </section>
  )
}
