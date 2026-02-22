import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { format, parseISO } from 'date-fns'
import { z } from 'zod'
import { useMemo, useState } from 'react'

import { workoutsCollection, workoutTypesCollection } from '@/lib/db'
import { getExerciseProgressSummaries } from '@/lib/selectors'
import type { ExerciseProgressSummary } from '@/lib/selectors'
import { getCopy, getDateLocale, type AppLanguage } from '@/lib/i18n'
import { resolveExerciseReferenceContent, resolveFreeExerciseDbEntry } from '@/lib/exerciseImages'
import type { FreeExerciseDbEntry } from '@/lib/exerciseImages'
import { getCatalogExerciseIdByName, getCatalogExerciseVariants } from '@/lib/variants'
import { ExerciseDetailImageCarousel } from '@/components/ExerciseDetailImageCarousel'

import styles from '../components/styles/ExerciseHistoryView.module.css'

const searchSchema = z.object({
  types: z.string().optional(),
  exMuscle: z.string().optional(),
  exEquipment: z.string().optional(),
  exDifficulty: z.string().optional(),
  exCategory: z.string().optional(),
})

const INITIAL_VISIBLE_LOGS = 3
const LOAD_MORE_STEP = 3
const MAX_WEIGHT_POINTS = 10
const FALLBACK_IMAGE = '/images/exercises/ex_bench_press.webp'

function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'en'
  }

  try {
    const storedLanguage = window.localStorage.getItem('workout-tracker-language')
    if (storedLanguage === 'en' || storedLanguage === 'sv') {
      return storedLanguage
    }
  } catch {
    // Keep default when storage is unavailable.
  }

  return 'en'
}

export const Route = createFileRoute('/exercises/$name')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ExerciseDetailPage,
})

function ExerciseDetailPage() {
  const { name: exerciseName } = Route.useParams()
  const search = Route.useSearch()
  const workoutsQuery = useLiveQuery(workoutsCollection)
  const typesQuery = useLiveQuery(workoutTypesCollection)

  const workouts = workoutsQuery.data ?? []
  const workoutTypes = typesQuery.data ?? []

  const selectedTypeIds = useMemo(
    () => (search.types ? search.types.split(',').filter(Boolean) : []),
    [search.types],
  )

  const language = getPreferredLanguage()
  const copy = getCopy(language)
  const dateLocale = getDateLocale(language)

  const exerciseKey = exerciseName

  const fallbackExerciseName = useMemo(() => {
    const variants = getCatalogExerciseVariants(exerciseKey)
    return variants.length > 0 ? variants[0] : exerciseKey
  }, [exerciseKey])

  const entries = useMemo(
    () =>
      getExerciseProgressSummaries({
        workouts,
        typeIds: selectedTypeIds,
        maxWeightPoints: MAX_WEIGHT_POINTS,
        availableExerciseNames: [fallbackExerciseName],
      }),
    [selectedTypeIds, workouts, fallbackExerciseName],
  )

  const entry = entries.find(
    (e) =>
      e.key === exerciseKey ||
      e.exerciseId === exerciseKey ||
      getCatalogExerciseIdByName(e.name) === exerciseKey ||
      e.name === exerciseKey,
  )

  const [visibleLogs, setVisibleLogs] = useState(INITIAL_VISIBLE_LOGS)
  const [referenceContent, setReferenceContent] = useState<{
    images: string[]
    instructions: string[]
    metadata?: Pick<
      FreeExerciseDbEntry,
      'category' | 'equipment' | 'force' | 'level' | 'mechanic' | 'primaryMuscles' | 'secondaryMuscles'
    >
  } | null>(null)

  useMemo(() => {
    if (!entry) {
      return
    }

    const exerciseImageId = getCatalogExerciseIdByName(entry.name)
    const fallbackId = exerciseImageId ?? 'ex_bench_press'

    Promise.all([
      resolveExerciseReferenceContent(fallbackId, entry.name),
      resolveFreeExerciseDbEntry(entry.name),
    ]).then(([content, dbEntry]) => {
      if (!content) {
        return
      }

      setReferenceContent({
        images: content.images,
        instructions: content.instructions,
        metadata: dbEntry
          ? {
              category: dbEntry.category,
              equipment: dbEntry.equipment,
              force: dbEntry.force,
              level: dbEntry.level,
              mechanic: dbEntry.mechanic,
              primaryMuscles: dbEntry.primaryMuscles,
              secondaryMuscles: dbEntry.secondaryMuscles,
            }
          : undefined,
      })
    })
  }, [entry])

  if (!entry) {
    return (
      <div className={styles.detailPageContainer}>
        <header className={styles.detailPageHeader}>
          <Link
            to="/"
            search={{
              view: 'exercises',
              types: search.types,
              exMuscle: search.exMuscle,
              exEquipment: search.exEquipment,
              exDifficulty: search.exDifficulty,
              exCategory: search.exCategory,
            }}
            className={styles.backButton}
          >
            ← {copy.common.back ?? 'Back'}
          </Link>
        </header>
        <div className={styles.notFound}>
          <h1>Exercise not found</h1>
          <p>The exercise "{exerciseKey}" could not be found.</p>
        </div>
      </div>
    )
  }

  const detailViewCopy = copy.historyView.detailView
  const exerciseImageId = getCatalogExerciseIdByName(entry.name)
  const fallbackImage = exerciseImageId
    ? `/images/exercises/${exerciseImageId}.webp`
    : FALLBACK_IMAGE
  const detailImages = referenceContent?.images?.length ? referenceContent.images : [fallbackImage]
  const detailLastRecorded = entry.lastRecordedAt
    ? format(parseISO(entry.lastRecordedAt), 'PPP', { locale: dateLocale })
    : copy.historyView.neverRecorded
  const stats = [
    { label: detailViewCopy.statsLastRecorded, value: detailLastRecorded },
    {
      label: detailViewCopy.statsSessionCount,
      value: copy.historyView.sessionCount(entry.totalLogs),
    },
    {
      label: detailViewCopy.statsWeight,
      value:
        entry.lastWeightKg !== null
          ? `${entry.lastWeightKg.toFixed(1)} kg`
          : copy.historyView.noWeights,
    },
  ]
  const lastLog = entry.logs[0]
  const detailSessionDate = lastLog
    ? format(parseISO(lastLog.date), 'PPP', { locale: dateLocale })
    : null
  const lastLogWeight =
    typeof lastLog?.weightKg === 'number'
      ? `${lastLog.weightKg.toFixed(1)} kg`
      : copy.historyView.noWeights
  const lastLogSets = lastLog?.setsLogged ?? 0
  const instructions = referenceContent?.instructions ?? []
  const metadata = referenceContent?.metadata
  const primaryMuscles = metadata?.primaryMuscles ?? []
  const secondaryMuscles = metadata?.secondaryMuscles ?? []
  const recentLogs = entry.logs.slice(0, visibleLogs)
  const remainingLogs = Math.max(0, entry.logs.length - visibleLogs)

  return (
    <div className={styles.detailPageContainer}>
      <header className={styles.detailPageHeader}>
        <Link
          to="/"
          search={{
            view: 'exercises',
            types: search.types,
            exMuscle: search.exMuscle,
            exEquipment: search.exEquipment,
            exDifficulty: search.exDifficulty,
            exCategory: search.exCategory,
          }}
          className={styles.backButton}
        >
          ← {copy.common.back ?? 'Back'}
        </Link>
      </header>
      <div className={styles.detailPageContent}>
        <div className={styles.detailHero}>
          <ExerciseDetailImageCarousel
            exerciseName={entry.name}
            images={detailImages}
            cycleHint={copy.historyView.cycleImageHint}
          />
          <div className={styles.detailHeroContent}>
            <span className={styles.detailHeroKicker}>{detailViewCopy.title}</span>
            <h3 id="exercise-detail-title">{entry.name}</h3>
            <p className={styles.detailHeroSubtitle}>
              {copy.historyView.sessionCount(entry.totalLogs)}
            </p>
          </div>
        </div>
        <div className={styles.detailStatsHeading}>{detailViewCopy.statsHeading}</div>
        <div className={styles.detailStats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.detailStatsItem}>
              <span className={styles.detailStatsLabel}>{stat.label}</span>
              <span className={styles.detailStatsValue}>{stat.value}</span>
            </div>
          ))}
        </div>
        {metadata ? (
          <div className={styles.metadataGrid}>
            {metadata.level ? (
              <div className={styles.metadataItem}>
                <span className={styles.metadataLabel}>
                  {copy.historyView.detailView.metadataLevel}
                </span>
                <span className={styles.metadataValue}>{metadata.level}</span>
              </div>
            ) : null}
            {metadata.equipment ? (
              <div className={styles.metadataItem}>
                <span className={styles.metadataLabel}>
                  {copy.historyView.detailView.metadataEquipment}
                </span>
                <span className={styles.metadataValue}>{metadata.equipment}</span>
              </div>
            ) : null}
            {metadata.mechanic ? (
              <div className={styles.metadataItem}>
                <span className={styles.metadataLabel}>
                  {copy.historyView.detailView.metadataMechanic}
                </span>
                <span className={styles.metadataValue}>{metadata.mechanic}</span>
              </div>
            ) : null}
            {metadata.force ? (
              <div className={styles.metadataItem}>
                <span className={styles.metadataLabel}>
                  {copy.historyView.detailView.metadataForce}
                </span>
                <span className={styles.metadataValue}>{metadata.force}</span>
              </div>
            ) : null}
            {metadata.category ? (
              <div className={styles.metadataItem}>
                <span className={styles.metadataLabel}>
                  {copy.historyView.detailView.metadataCategory}
                </span>
                <span className={styles.metadataValue}>{metadata.category}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {primaryMuscles.length > 0 ? (
          <div className={styles.muscleGroup}>
            <span className={styles.muscleLabel}>
              {copy.historyView.detailView.primaryMuscles}
            </span>
            <div className={styles.muscleChips}>
              {primaryMuscles.map((muscle) => (
                <span key={`primary-${entry.key}-${muscle}`} className={styles.muscleChip}>
                  {muscle}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {secondaryMuscles.length > 0 ? (
          <div className={styles.muscleGroup}>
            <span className={styles.muscleLabel}>
              {copy.historyView.detailView.secondaryMuscles}
            </span>
            <div className={styles.muscleChips}>
              {secondaryMuscles.map((muscle) => (
                <span
                  key={`secondary-${entry.key}-${muscle}`}
                  className={styles.muscleChipSecondary}
                >
                  {muscle}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className={styles.detailSession}>
          <span className={styles.detailSessionHeading}>{detailViewCopy.lastSessionHeading}</span>
          {lastLog ? (
            <div className={styles.detailSessionBody}>
              <p className={styles.detailSessionDate}>{detailSessionDate}</p>
              <div className={styles.detailSessionMetrics}>
                <span className={styles.detailSessionMetric}>{lastLogWeight}</span>
                <span className={styles.detailSessionMetric}>
                  {lastLogSets} {detailViewCopy.lastSessionSets}
                </span>
              </div>
            </div>
          ) : (
            <p className={styles.detailSessionEmpty}>{detailViewCopy.noSessions}</p>
          )}
        </div>
        <div className={styles.historyList}>
          <span className={styles.historyLabel}>{copy.historyView.latestSessions}</span>
          {recentLogs.length ? (
            <div className={styles.historyValues}>
              {recentLogs.map((log) => (
                <span key={`${entry.key}-${log.date}`} className={styles.historyValue}>
                  {format(parseISO(log.date), 'MMM d', { locale: dateLocale })}
                  {typeof log.weightKg === 'number' ? ` · ${log.weightKg.toFixed(1)}kg` : ''}
                </span>
              ))}
            </div>
          ) : (
            <p className={styles.detailSessionEmpty}>{detailViewCopy.noSessions}</p>
          )}
          {remainingLogs > 0 ? (
            <button
              type="button"
              className={styles.loadMore}
              onClick={() => setVisibleLogs((prev) => prev + LOAD_MORE_STEP)}
            >
              {copy.historyView.loadMoreLogs(Math.min(LOAD_MORE_STEP, remainingLogs))}
            </button>
          ) : null}
        </div>
        <div className={styles.sparklineArea}>
          {entry.weightPoints.length > 1 ? (
            <WeightSparkline points={entry.weightPoints} />
          ) : (
            <span className={styles.noWeights}>{copy.historyView.noWeights}</span>
          )}
          <span className={styles.sparklineLabel}>{copy.historyView.weightTrendLabel}</span>
        </div>
        {instructions.length > 0 ? (
          <div className={styles.detailInstructions}>
            <span className={styles.detailInstructionsHeading}>
              {copy.historyView.instructionsTitle}
            </span>
            <ol className={styles.detailInstructionsList}>
              {instructions.map((instruction, instructionIndex) => (
                <li key={`${entry.key}-detail-instruction-${instructionIndex}`}>{instruction}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type TimelinePoint = {
  date: string
  value: number
}

function WeightSparkline({ points }: { points: TimelinePoint[] }) {
  if (points.length < 2) {
    return null
  }

  const width = 220
  const height = 62
  const padding = 12
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const path = points
    .map((point, index) => {
      const x = padding + step * index
      const y = height - padding - ((point.value - min) / range) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const lastPoint = points[points.length - 1]
  const lastX = padding + step * (points.length - 1)
  const lastY = height - padding - ((lastPoint.value - min) / range) * (height - padding * 2)

  return (
    <svg
      className={styles.sparklineSvg}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Weight trend ${points.map((point) => `${point.value}kg`).join(', ')}`}
    >
      <path d={path} className={styles.sparklinePath} />
      <circle className={styles.sparklineDot} cx={lastX} cy={lastY} r="3.5" />
    </svg>
  )
}
