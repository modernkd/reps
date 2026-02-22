import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

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

import type { AppLanguage } from '@/lib/i18n'
import { getCopy, getDateLocale, localizeWorkoutTypeName } from '@/lib/i18n'
import {
  getExerciseInsights,
  getRunProgressSeries,
  getStrengthExerciseNames,
  getStrengthProgressSeries,
  type ExerciseInsightMetadata,
  type MajorMuscleGroup,
} from '@/lib/selectors'
import type {
  ProgressPoint,
  WeeklyTrendPoint,
  WeeklyTrendSeries,
  Workout,
  WorkoutType,
} from '@/lib/types'
import { useReducedMotion } from '@/lib/useReducedMotion'

import SimpleGraph from './react-bits/simple-graph'
import styles from './styles/GraphView.module.css'

type GraphViewProps = {
  language: AppLanguage
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
const MARGIN = { top: 18, right: 56, bottom: 34, left: 48 }

function normalizeInsightKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatInsightLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getMuscleLabel(
  graphCopy: ReturnType<typeof getCopy>['graph'],
  muscle: MajorMuscleGroup,
): string {
  return graphCopy.muscles[muscle]
}

export function GraphView({
  language,
  series,
  workouts,
  workoutTypes,
  selectedTypeIds,
  onPointSelect,
}: GraphViewProps) {
  const copy = getCopy(language)
  const dateLocale = getDateLocale(language)
  const reducedMotion = useReducedMotion()
  const axisBottomRef = useRef<SVGGElement | null>(null)
  const axisLeftRef = useRef<SVGGElement | null>(null)
  const axisRightRef = useRef<SVGGElement | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [focusTypeId, setFocusTypeId] = useState<string>('')
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [runMetric, setRunMetric] = useState<'pace' | 'speed'>('pace')
  const [metadataByExercise, setMetadataByExercise] = useState<
    Record<string, ExerciseInsightMetadata | undefined>
  >({})

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
  const weekStarts = useMemo(() => points.map((point) => point.weekStart), [points])

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

  const scopedWorkouts = useMemo(() => {
    const activeTypes = selectedTypeIds.length > 0 ? new Set(selectedTypeIds) : null

    return workouts.filter((workout) =>
      activeTypes ? activeTypes.has(workout.type) : true,
    )
  }, [selectedTypeIds, workouts])

  const insightLookupNames = useMemo(() => {
    const keys = new Set<string>()

    for (const workout of scopedWorkouts) {
      for (const setLog of workout.sessionSummary?.setLogs ?? []) {
        if (setLog.exerciseName?.trim()) {
          keys.add(setLog.exerciseName.trim())
        }
        if (setLog.exerciseId?.trim()) {
          keys.add(setLog.exerciseId.trim())
        }
      }
    }

    return [...keys]
  }, [scopedWorkouts])

  useEffect(() => {
    let cancelled = false

    async function loadInsightMetadata() {
      if (insightLookupNames.length === 0) {
        if (!cancelled) {
          setMetadataByExercise({})
        }
        return
      }

      const { getExerciseByName } = await import('@/lib/exerciseDb')
      const lookups = await Promise.all(
        insightLookupNames.map(async (rawKey) => ({
          rawKey,
          exercise: await getExerciseByName(rawKey),
        })),
      )

      if (cancelled) {
        return
      }

      const next: Record<string, ExerciseInsightMetadata | undefined> = {}
      for (const lookup of lookups) {
        const normalizedRaw = normalizeInsightKey(lookup.rawKey)
        if (!normalizedRaw) {
          continue
        }

        const exercise = lookup.exercise
        if (!exercise) {
          continue
        }

        const metadata: ExerciseInsightMetadata = {
          equipment: exercise.equipment,
          level: exercise.level,
          primaryMuscles: exercise.primaryMuscles,
        }

        next[normalizedRaw] = metadata
        next[normalizeInsightKey(exercise.name)] = metadata
        next[normalizeInsightKey(exercise.id)] = metadata
      }

      setMetadataByExercise(next)
    }

    void loadInsightMetadata()

    return () => {
      cancelled = true
    }
  }, [insightLookupNames])

  const exerciseInsights = useMemo(
    () =>
      getExerciseInsights({
        workouts: scopedWorkouts,
        weekStarts,
        metadataByExercise,
      }),
    [metadataByExercise, scopedWorkouts, weekStarts],
  )

  const muscleCoverageMax = useMemo(() => {
    const values = exerciseInsights.muscleCoverage.flatMap((week) =>
      exerciseInsights.muscleGroups.map((muscle) => week.muscles[muscle]),
    )

    return max(values) ?? 0
  }, [exerciseInsights])

  const hasMuscleCoverage = useMemo(
    () =>
      exerciseInsights.muscleCoverage.some((week) =>
        exerciseInsights.muscleGroups.some((muscle) => week.muscles[muscle] > 0),
      ),
    [exerciseInsights],
  )

  const balanceTotal =
    exerciseInsights.balance.push +
    exerciseInsights.balance.pull +
    exerciseInsights.balance.lower

  const balanceItems = [
    {
      key: 'push',
      label: copy.graph.pushLabel,
      value: exerciseInsights.balance.push,
    },
    {
      key: 'pull',
      label: copy.graph.pullLabel,
      value: exerciseInsights.balance.pull,
    },
    {
      key: 'lower',
      label: copy.graph.lowerLabel,
      value: exerciseInsights.balance.lower,
    },
  ] as const

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
      ? copy.graph.yPace
      : copy.graph.ySpeed
    : copy.graph.yStrength

  const performanceTitle = isRunLike
    ? runMetric === 'pace'
      ? copy.graph.runPaceProgress
      : copy.graph.runSpeedProgress
    : selectedExercise
      ? `${selectedExercise} ${copy.graph.exerciseProgressSuffix}`
      : copy.graph.exerciseProgress

  const weightTrendData = useMemo(
    () =>
      weightPoints.map((point) => ({
        value: point.avgWeightKg ?? 0,
        label: format(parseISO(point.weekStart), 'MMM d', { locale: dateLocale }),
      })),
    [dateLocale, weightPoints],
  )

  const performanceTrendData = useMemo(
    () =>
      performancePoints.map((point) => ({
        value: point.value,
        label: format(parseISO(point.date), 'MMM d', { locale: dateLocale }),
      })),
    [dateLocale, performancePoints],
  )

  useEffect(() => {
    if (!axisBottomRef.current || !axisLeftRef.current || !axisRightRef.current) {
      return
    }

    const xAxis = axisBottom<Date>(xScale)
      .ticks(Math.min(8, points.length))
      .tickFormat((value) => format(value, 'MMM d', { locale: dateLocale }))

    const leftAxis = axisLeft(yFrequency).ticks(6)
    const rightAxis = axisRight(yDuration).ticks(6)

    select(axisBottomRef.current).call(xAxis)
    select(axisLeftRef.current).call(leftAxis)
    select(axisRightRef.current).call(rightAxis)
  }, [dateLocale, points.length, xScale, yDuration, yFrequency])

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
      <section className={styles.empty} aria-label={copy.graph.emptyAria}>
        <h3>{copy.graph.noWorkoutData}</h3>
        <p>{copy.graph.logToUnlock}</p>
      </section>
    )
  }

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h3>{copy.graph.title}</h3>
        <p aria-live="polite">{copy.graph.subtitle}</p>
      </header>

      <div className={styles.legend} aria-hidden>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatchWorkouts} />
          workouts / week
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatchDuration} />
          duration / week
        </span>
      </div>

      <div className={styles.chartWrap} ref={chartRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.chart}
          role="img"
          aria-label={copy.graph.chartAria}
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
                    role="button"
                    tabIndex={0}
                    aria-label={`${format(parseISO(point.weekStart), 'MMM d', {
                      locale: dateLocale,
                    })}: ${copy.graph.tooltipWorkouts(point.workoutsPerWeek)}`}
                    onClick={() => onPointSelect(point.weekStart)}
                    onFocus={() =>
                      setTooltip({
                        x: MARGIN.left + xScale(parseISO(point.weekStart)),
                        y: MARGIN.top + yFrequency(point.workoutsPerWeek),
                        point,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onPointSelect(point.weekStart)
                      }
                    }}
                  />
                  <circle
                    data-anim="point"
                    className={styles.durationPoint}
                    cx={x}
                    cy={yDuration(point.totalDurationPerWeek)}
                    r={3.5}
                    role="button"
                    tabIndex={0}
                    aria-label={`${format(parseISO(point.weekStart), 'MMM d', {
                      locale: dateLocale,
                    })}: ${d3Format(',')(point.totalDurationPerWeek)} min`}
                    onClick={() => onPointSelect(point.weekStart)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onPointSelect(point.weekStart)
                      }
                    }}
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
            <strong>{format(parseISO(tooltip.point.weekStart), 'MMM d', { locale: dateLocale })}</strong>
            <span>{copy.graph.tooltipWorkouts(tooltip.point.workoutsPerWeek)}</span>
            <span>{d3Format(',')(tooltip.point.totalDurationPerWeek)} min</span>
            {tooltip.point.avgWeightKg ? (
              <span>{copy.graph.tooltipAvgWeight(tooltip.point.avgWeightKg)}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {weightPoints.length > 0 ? (
        <div className={styles.weightWrap}>
          <h4>{copy.graph.avgWeightTitle}</h4>
          <SimpleGraph
            data={weightTrendData}
            height={180}
            lineColor="#2f6f4f"
            dotColor="#2f6f4f"
            graphLineThickness={2.4}
            dotSize={4}
            animationDuration={0.6}
            showGrid
            gridLines="horizontal"
            gridStyle="dashed"
            className={styles.simpleGraph}
          />
          <p className={styles.metricLabel} aria-label={copy.graph.avgWeightAria}>
            kg
          </p>
        </div>
      ) : (
        <p className={styles.weightHint}>{copy.graph.avgWeightHint}</p>
      )}

      <div className={styles.performanceWrap}>
        <div className={styles.performanceHeader}>
          <h4>{copy.graph.performanceTitle}</h4>
          <div className={styles.performanceControls}>
            <label>
              {copy.graph.type}
              <select
                value={focusTypeId}
                onChange={(event) => setFocusTypeId(event.target.value)}
              >
                {typeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {localizeWorkoutTypeName(type, language)}
                  </option>
                ))}
              </select>
            </label>

            {isRunLike ? (
              <label>
                {copy.graph.metric}
                <select
                  value={runMetric}
                  onChange={(event) =>
                    setRunMetric(event.target.value as 'pace' | 'speed')
                  }
                >
                  <option value="pace">{copy.graph.pace}</option>
                  <option value="speed">{copy.graph.speed}</option>
                </select>
              </label>
            ) : (
              <label>
                {copy.graph.exercise}
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
          <SimpleGraph
            data={performanceTrendData}
            height={210}
            lineColor="#0f766e"
            dotColor="#0f766e"
            graphLineThickness={2.4}
            dotSize={4}
            animationDuration={0.65}
            showGrid
            gridLines="horizontal"
            gridStyle="dashed"
            className={styles.simpleGraph}
          />
        ) : (
          <p className={styles.weightHint}>
            {isRunLike
              ? copy.graph.noRunData
              : copy.graph.noStrengthData}
          </p>
        )}

        <p className={styles.metricLabel}>{performanceYLabel}</p>
      </div>

      <section className={styles.insightSection}>
        <header className={styles.insightHeader}>
          <h4>{copy.graph.muscleCoverageTitle}</h4>
          <p>{copy.graph.muscleCoverageSubtitle}</p>
        </header>
        {hasMuscleCoverage ? (
          <div
            className={styles.coverageTable}
            role="table"
            aria-label={copy.graph.muscleCoverageTitle}
            style={{
              gridTemplateColumns: `minmax(6.4rem, auto) repeat(${Math.max(
                1,
                weekStarts.length,
              )}, minmax(2.3rem, 1fr))`,
            }}
          >
            <div className={styles.coverageRowLabel}>{copy.graph.muscleLabel}</div>
            {weekStarts.map((weekStart) => (
              <div key={`week-header-${weekStart}`} className={styles.coverageColumnLabel}>
                {format(parseISO(weekStart), 'MMM d', { locale: dateLocale })}
              </div>
            ))}

            {exerciseInsights.muscleGroups.map((muscle) => (
              <Fragment key={muscle}>
                <div className={styles.coverageRowLabel}>
                  {getMuscleLabel(copy.graph, muscle)}
                </div>
                {exerciseInsights.muscleCoverage.map((week) => {
                  const value = week.muscles[muscle]
                  const intensity =
                    muscleCoverageMax > 0
                      ? Math.min(4, Math.ceil((value / muscleCoverageMax) * 4))
                      : 0

                  return (
                    <div
                      key={`${muscle}-${week.weekStart}`}
                      className={`${styles.coverageCell} ${
                        intensity === 0
                          ? styles.coverageCell0
                          : intensity === 1
                            ? styles.coverageCell1
                            : intensity === 2
                              ? styles.coverageCell2
                              : intensity === 3
                                ? styles.coverageCell3
                                : styles.coverageCell4
                      }`}
                      aria-label={`${getMuscleLabel(copy.graph, muscle)} ${format(
                        parseISO(week.weekStart),
                        'MMM d',
                        { locale: dateLocale },
                      )}: ${value}`}
                    >
                      {value > 0 ? value : ''}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        ) : (
          <p className={styles.insightEmpty}>{copy.graph.muscleCoverageEmpty}</p>
        )}
      </section>

      <section className={styles.insightSection}>
        <header className={styles.insightHeader}>
          <h4>{copy.graph.balanceTitle}</h4>
          <p>{copy.graph.balanceSubtitle}</p>
        </header>
        {balanceTotal > 0 ? (
          <>
            <div className={styles.balanceGrid}>
              {balanceItems.map((item) => {
                const ratio = balanceTotal > 0 ? (item.value / balanceTotal) * 100 : 0
                return (
                  <article key={item.key} className={styles.balanceCard}>
                    <div className={styles.balanceRow}>
                      <span>{item.label}</span>
                      <strong>{item.value.toFixed(1)}</strong>
                    </div>
                    <div className={styles.balanceTrack} aria-hidden>
                      <span className={styles.balanceFill} style={{ width: `${ratio}%` }} />
                    </div>
                  </article>
                )
              })}
            </div>
            <p className={styles.insightMeta}>{copy.graph.totalSets(balanceTotal)}</p>
          </>
        ) : (
          <p className={styles.insightEmpty}>{copy.graph.balanceEmpty}</p>
        )}
      </section>

      <section className={styles.insightSection}>
        <header className={styles.insightHeader}>
          <h4>{copy.graph.equipmentTrendsTitle}</h4>
          <p>{copy.graph.equipmentTrendsSubtitle}</p>
        </header>
        {exerciseInsights.equipmentTrends.length > 0 ? (
          <div className={styles.trendRows}>
            {exerciseInsights.equipmentTrends.map((trend) => {
              const peak = Math.max(1, ...trend.points)

              return (
                <article key={trend.key} className={styles.trendRow}>
                  <div className={styles.trendHeader}>
                    <span>{formatInsightLabel(trend.key)}</span>
                    <strong>{copy.graph.totalSets(trend.total)}</strong>
                  </div>
                  <div
                    className={styles.trendBars}
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, trend.points.length)}, minmax(0, 1fr))`,
                    }}
                  >
                    {trend.points.map((value, index) => (
                      <div key={`${trend.key}-${index}`} className={styles.trendBarWrap}>
                        <div
                          className={styles.trendBar}
                          style={{
                            height: value > 0 ? `${Math.max(20, (value / peak) * 100)}%` : '8%',
                            opacity: value > 0 ? 0.9 : 0.35,
                          }}
                          title={`${format(parseISO(weekStarts[index] ?? weekStarts[0]), 'MMM d', {
                            locale: dateLocale,
                          })}: ${value}`}
                        />
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className={styles.insightEmpty}>{copy.graph.equipmentTrendsEmpty}</p>
        )}
      </section>

      <section className={styles.insightSection}>
        <header className={styles.insightHeader}>
          <h4>{copy.graph.difficultyTrendsTitle}</h4>
          <p>{copy.graph.difficultyTrendsSubtitle}</p>
        </header>
        {exerciseInsights.difficultyTrends.length > 0 ? (
          <div className={styles.trendRows}>
            {exerciseInsights.difficultyTrends.map((trend) => {
              const peak = Math.max(1, ...trend.points)

              return (
                <article key={trend.key} className={styles.trendRow}>
                  <div className={styles.trendHeader}>
                    <span>{formatInsightLabel(trend.key)}</span>
                    <strong>{copy.graph.totalSets(trend.total)}</strong>
                  </div>
                  <div
                    className={styles.trendBars}
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, trend.points.length)}, minmax(0, 1fr))`,
                    }}
                  >
                    {trend.points.map((value, index) => (
                      <div key={`${trend.key}-${index}`} className={styles.trendBarWrap}>
                        <div
                          className={styles.trendBar}
                          style={{
                            height: value > 0 ? `${Math.max(20, (value / peak) * 100)}%` : '8%',
                            opacity: value > 0 ? 0.9 : 0.35,
                          }}
                          title={`${format(parseISO(weekStarts[index] ?? weekStarts[0]), 'MMM d', {
                            locale: dateLocale,
                          })}: ${value}`}
                        />
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className={styles.insightEmpty}>{copy.graph.difficultyTrendsEmpty}</p>
        )}
      </section>
    </section>
  )
}
