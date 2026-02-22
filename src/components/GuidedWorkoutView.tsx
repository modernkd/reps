import { differenceInSeconds, formatDistanceStrict, parseISO } from 'date-fns'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'

import { Modal } from '@/components/Modal'
import { estimateWorkoutCaloriesBurned } from '@/lib/calories'
import { nowIso } from '@/lib/date'
import {
  readFileAsDataUrl,
  saveUploadedExerciseImage,
} from '@/lib/exerciseImages'
import type { AppLanguage } from '@/lib/i18n'
import { getCopy, getDateLocale } from '@/lib/i18n'
import {
  addGuidedRestIncrement,
  GUIDED_REST_DEFAULT_SEC,
  GUIDED_REST_INCREMENT_SEC,
} from '@/lib/restTimer'
import {
  getCatalogExerciseVariants,
  isCustomExerciseVariant,
} from '@/lib/variants'
import { useExerciseReferenceContent } from '@/lib/useExerciseReferenceContent'
import { inferWorkoutTypeFromPlanDay } from '@/lib/workoutType'
import type {
  ActiveSessionDraft,
  ExerciseTemplate,
  PlanDay,
  ScheduledSession,
  SessionSummary,
  SetLog,
} from '@/lib/types'

import styles from './styles/GuidedWorkoutView.module.css'

type GuidedWorkoutViewProps = {
  language: AppLanguage
  session: ScheduledSession
  planDay: PlanDay | undefined
  exercises: ExerciseTemplate[]
  draft: ActiveSessionDraft
  onSaveDraft: (updater: (draft: ActiveSessionDraft) => ActiveSessionDraft) => Promise<void>
  onComplete: (summary: SessionSummary, notes?: string) => Promise<void>
  onAbort: () => Promise<void>
  onSwapExerciseVariant: (exerciseIndex: number, nextName: string) => Promise<void>
  latestWeightByExerciseName: Record<string, number>
}

function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function getRemainingSeconds(restEndAt?: string, explicitRemaining?: number): number {
  if (!restEndAt) {
    return explicitRemaining ?? GUIDED_REST_DEFAULT_SEC
  }

  const delta = differenceInSeconds(parseISO(restEndAt), new Date())
  return Math.max(0, delta)
}

function nextSetPosition(
  currentExerciseIndex: number,
  currentSetIndex: number,
  exercises: ExerciseTemplate[],
): { exerciseIndex: number; setIndex: number; finished: boolean } {
  const exercise = exercises[currentExerciseIndex]
  if (!exercise) {
    return { exerciseIndex: currentExerciseIndex, setIndex: currentSetIndex, finished: true }
  }

  const nextSet = currentSetIndex + 1
  if (nextSet < exercise.sets) {
    return { exerciseIndex: currentExerciseIndex, setIndex: nextSet, finished: false }
  }

  const nextExercise = currentExerciseIndex + 1
  if (nextExercise < exercises.length) {
    return { exerciseIndex: nextExercise, setIndex: 0, finished: false }
  }

  return { exerciseIndex: currentExerciseIndex, setIndex: currentSetIndex, finished: true }
}

function variantSuggestionListId(exerciseId: string): string {
  return `guided_variant_${exerciseId}`
}

type CompletionPreview = {
  summary: SessionSummary
  estimatedCalories: number
}

export function GuidedWorkoutView({
  language,
  session,
  planDay,
  exercises,
  draft,
  onSaveDraft,
  onComplete,
  onAbort,
  onSwapExerciseVariant,
  latestWeightByExerciseName,
}: GuidedWorkoutViewProps) {
  const copy = getCopy(language)
  const dateLocale = getDateLocale(language)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(
    draft.currentExerciseIndex,
  )
  const [currentSetIndex, setCurrentSetIndex] = useState(draft.currentSetIndex)
  const [setLogs, setSetLogs] = useState<SetLog[]>(draft.setLogs)
  const [restSecLeft, setRestSecLeft] = useState(
    getRemainingSeconds(draft.restEndAt, draft.timerRemainingSec),
  )
  const [timerPaused, setTimerPaused] = useState(draft.timerPaused)
  const [reps, setReps] = useState(8)
  const [weightKg, setWeightKg] = useState(0)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [variantInput, setVariantInput] = useState('')
  const [imageRefreshKey, setImageRefreshKey] = useState(0)
  const [referenceImageIndex, setReferenceImageIndex] = useState(0)
  const [completionPreview, setCompletionPreview] = useState<CompletionPreview | null>(
    null,
  )

  const currentExercise = exercises[currentExerciseIndex]
  const currentVariantOptions = currentExercise
    ? getCatalogExerciseVariants(currentExercise.id)
    : []
  const typedVariant = variantInput.trim()
  const customExercise = currentExercise
    ? isCustomExerciseVariant(currentExercise.id, typedVariant)
    : false
  const referenceExerciseName = typedVariant || currentExercise?.name || ''
  const { content: referenceContent, isLoading: isReferenceImageLoading } =
    useExerciseReferenceContent(
      currentExercise?.id ?? '',
      referenceExerciseName,
      imageRefreshKey,
    )
  const referenceImages = referenceContent?.images ?? []
  const referenceInstructions = referenceContent?.instructions ?? []
  const hasReferenceImages = referenceImages.length > 0
  const activeReferenceImage = hasReferenceImages
    ? referenceImages[referenceImageIndex % referenceImages.length]
    : undefined
  const canCycleReferenceImages = referenceImages.length > 1

  const totalSetsTarget = exercises.reduce((acc, exercise) => acc + exercise.sets, 0)
  const completedSets = setLogs.length
  const isWorkoutSetsComplete =
    totalSetsTarget > 0 && completedSets >= totalSetsTarget

  useEffect(() => {
    if (!draft.restEndAt) {
      return
    }

    setRestSecLeft(getRemainingSeconds(draft.restEndAt, draft.timerRemainingSec))
  }, [draft.restEndAt, draft.timerRemainingSec])

  useEffect(() => {
    if (!currentExercise) {
      setVariantInput('')
      return
    }

    setVariantInput(currentExercise.name)
  }, [currentExercise?.id, currentExercise?.name])

  useEffect(() => {
    setReferenceImageIndex(0)
  }, [currentExercise?.id, referenceExerciseName, imageRefreshKey])

  useEffect(() => {
    if (!currentExercise) {
      setWeightKg(0)
      return
    }

    const normalized = normalizeExerciseName(currentExercise.name)
    const nextWeight = latestWeightByExerciseName[normalized]
    if (typeof nextWeight === 'number') {
      setWeightKg(nextWeight)
      return
    }

    setWeightKg(currentExercise.targetMassKg ?? 0)
  }, [
    currentExercise?.id,
    currentExercise?.name,
    currentExercise?.targetMassKg,
    latestWeightByExerciseName,
  ])

  useEffect(() => {
    if (timerPaused || restSecLeft <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setRestSecLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [timerPaused, restSecLeft])

  const progressText = useMemo(() => {
    if (completedSets === 0) {
      return copy.guided.startFirstSet
    }

    if (isWorkoutSetsComplete) {
      return copy.guided.startCoolDown
    }

    return copy.guided.setsLogged(completedSets, totalSetsTarget)
  }, [completedSets, copy.guided, isWorkoutSetsComplete, totalSetsTarget])

  const visibleExercise = isWorkoutSetsComplete ? undefined : currentExercise
  const setCounterText = visibleExercise
    ? `${copy.guided.set} ${currentSetIndex + 1} ${copy.guided.of} ${visibleExercise.sets}`
    : ''
  const exerciseTargetTextParts: string[] = []

  if (visibleExercise?.minReps || visibleExercise?.maxReps) {
    exerciseTargetTextParts.push(
      `${copy.guided.target} ${visibleExercise.minReps ?? visibleExercise.maxReps}-${visibleExercise.maxReps ?? visibleExercise.minReps} ${copy.guided.reps}`,
    )
  }

  if (visibleExercise?.targetMassKg) {
    exerciseTargetTextParts.push(`${copy.guided.target} ${visibleExercise.targetMassKg} kg`)
  }

  const persist = async (next: {
    exerciseIndex: number
    setIndex: number
    nextSetLogs: SetLog[]
    nextRestSec: number
    nextTimerPaused: boolean
  }) => {
    const restEndAt =
      next.nextRestSec > 0 && !next.nextTimerPaused
        ? new Date(Date.now() + next.nextRestSec * 1000).toISOString()
        : undefined

    await onSaveDraft((prev) => ({
      ...prev,
      currentExerciseIndex: next.exerciseIndex,
      currentSetIndex: next.setIndex,
      setLogs: next.nextSetLogs,
      timerPaused: next.nextTimerPaused,
      timerRemainingSec: next.nextRestSec,
      restEndAt,
      updatedAt: nowIso(),
    }))
  }

  const commitVariantInput = async (): Promise<string | undefined> => {
    if (!currentExercise) {
      return undefined
    }

    const nextName = variantInput.trim()
    if (!nextName) {
      setVariantInput(currentExercise.name)
      return currentExercise.name
    }

    if (nextName === currentExercise.name) {
      return currentExercise.name
    }

    try {
      await onSwapExerciseVariant(currentExerciseIndex, nextName)
      return nextName
    } catch {
      setVariantInput(currentExercise.name)
      return currentExercise.name
    }
  }

  const handleUploadCustomImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    const resolvedName = await commitVariantInput()
    if (!resolvedName?.trim()) {
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      saveUploadedExerciseImage(resolvedName, dataUrl)
      setImageRefreshKey((value) => value + 1)
    } catch {
      // Keep guided flow active even if upload cannot be processed.
    }
  }

  const handleCompleteSet = async () => {
    if (!currentExercise || isWorkoutSetsComplete) {
      return
    }

    const committedName = await commitVariantInput()
    const exerciseName = committedName?.trim() ? committedName : currentExercise.name
    const targetReps = currentExercise.maxReps ?? currentExercise.minReps
    const nextLog: SetLog = {
      exerciseId: currentExercise.id,
      exerciseName,
      setIndex: currentSetIndex,
      targetReps,
      actualReps: Math.max(0, reps),
      weightKg: weightKg > 0 ? weightKg : undefined,
      restSecUsed: GUIDED_REST_DEFAULT_SEC,
    }

    const nextSetLogs = [...setLogs, nextLog]
    const nextPosition = nextSetPosition(
      currentExerciseIndex,
      currentSetIndex,
      exercises,
    )
    const nextRestSec = GUIDED_REST_DEFAULT_SEC

    setSetLogs(nextSetLogs)
    setRestSecLeft(nextRestSec)
    setTimerPaused(false)

    if (!nextPosition.finished) {
      setCurrentExerciseIndex(nextPosition.exerciseIndex)
      setCurrentSetIndex(nextPosition.setIndex)
    }

    await persist({
      exerciseIndex: nextPosition.exerciseIndex,
      setIndex: nextPosition.setIndex,
      nextSetLogs,
      nextRestSec,
      nextTimerPaused: false,
    })
  }

  const updateTimer = async (nextSec: number, paused: boolean) => {
    setRestSecLeft(nextSec)
    setTimerPaused(paused)

    await persist({
      exerciseIndex: currentExerciseIndex,
      setIndex: currentSetIndex,
      nextSetLogs: setLogs,
      nextRestSec: nextSec,
      nextTimerPaused: paused,
    })
  }

  const buildCompletionPreview = (): CompletionPreview => {
    const endedAt = nowIso()
    const minutes = Math.max(
      1,
      Math.round(
        differenceInSeconds(parseISO(endedAt), parseISO(draft.startedAt)) / 60,
      ),
    )
    const summary: SessionSummary = {
      startedAt: draft.startedAt,
      endedAt,
      totalDurationMin: minutes,
      setLogs,
    }

    const estimatedCalories = estimateWorkoutCaloriesBurned({
      durationMin: summary.totalDurationMin,
      type: inferWorkoutTypeFromPlanDay(planDay),
      sessionSummary: summary,
    })

    return {
      summary,
      estimatedCalories,
    }
  }

  const handleFinish = () => {
    setCompletionPreview(buildCompletionPreview())
  }

  const handleConfirmFinish = async () => {
    if (!completionPreview) {
      return
    }

    setIsSubmitting(true)
    try {
      await onComplete(completionPreview.summary, notes || undefined)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={styles.wrapper} aria-label={copy.guided.sectionAria}>
      <header className={styles.header}>
        <div>
          <h2>{planDay?.label ?? copy.guided.fallbackTitle}</h2>
          <p>{copy.guided.sessionDateLine(session.date, progressText)}</p>
        </div>
        <button type="button" className={styles.abort} onClick={onAbort}>
          {copy.guided.endSession}
        </button>
      </header>

      <article className={styles.card}>
        <h3>{visibleExercise?.name ?? copy.guided.allExercisesComplete}</h3>
        {exerciseTargetTextParts.length > 0 ? <p>{exerciseTargetTextParts.join(' · ')}</p> : null}

        {visibleExercise ? (
          <label className={styles.variantControl}>
            {copy.guided.variant}
            <input
              list={variantSuggestionListId(visibleExercise.id)}
              value={variantInput}
              placeholder={copy.guided.exerciseVariantPlaceholder}
              onChange={(event) => setVariantInput(event.target.value)}
              onBlur={() => {
                void commitVariantInput()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitVariantInput()
                }
              }}
            />
            <datalist id={variantSuggestionListId(visibleExercise.id)}>
              {currentVariantOptions.map((variant) => (
                <option key={variant} value={variant} />
              ))}
            </datalist>
          </label>
        ) : null}

        {visibleExercise ? (
          <section className={styles.referenceCard}>
            <div className={styles.referenceMediaFrame}>
              {activeReferenceImage ? (
                <>
                  <button
                    type="button"
                    className={styles.referenceImageButton}
                    onClick={() => {
                      if (!canCycleReferenceImages) {
                        return
                      }

                      setReferenceImageIndex((current) => (current + 1) % referenceImages.length)
                    }}
                    aria-label={
                      canCycleReferenceImages
                        ? copy.guided.cycleReferenceImage(
                            referenceImageIndex + 1,
                            referenceImages.length,
                          )
                        : copy.guided.referenceImageAlt(referenceExerciseName)
                    }
                  >
                    <img
                      src={activeReferenceImage}
                      alt={copy.guided.referenceImageAlt(referenceExerciseName)}
                      loading="lazy"
                      className={styles.referenceImage}
                    />
                  </button>
                  {canCycleReferenceImages ? (
                    <span className={styles.referenceImageStep}>
                      {referenceImageIndex + 1}/{referenceImages.length}
                    </span>
                  ) : null}
                </>
              ) : (
                <p className={styles.referenceHint}>
                  {isReferenceImageLoading
                    ? copy.guided.loadingReferenceImage
                    : copy.guided.missingReferenceImage}
                </p>
              )}
            </div>

            {canCycleReferenceImages ? (
              <p className={styles.referenceHint}>
                {copy.guided.cycleReferenceImage(referenceImageIndex + 1, referenceImages.length)}
              </p>
            ) : null}

            {referenceInstructions.length > 0 ? (
              <section className={styles.referenceInstructions}>
                <h4>{copy.guided.instructionsTitle}</h4>
                <ol>
                  {referenceInstructions.map((instruction, index) => (
                    <li key={`${referenceExerciseName}-${index}`}>{instruction}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {customExercise ? (
              <>
                <p className={styles.referenceHint}>{copy.guided.customExerciseHint}</p>
                <label className={styles.uploadButton}>
                  {copy.guided.uploadCustomImage}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCustomImage}
                  />
                </label>
              </>
            ) : null}
          </section>
        ) : null}

        {visibleExercise ? (
          <>
            <div className={styles.repControls}>
              <button type="button" onClick={() => setReps((value) => Math.max(0, value - 1))}>
                -
              </button>
              <input
                type="number"
                min={0}
                value={reps}
                onChange={(event) => setReps(Number(event.target.value) || 0)}
              />
              <button type="button" onClick={() => setReps((value) => value + 1)}>
                +
              </button>
              <span>{copy.guided.reps}</span>
            </div>

            <label className={styles.weightControl}>
              {copy.guided.weightForSet}
              <input
                type="number"
                min={0}
                step={0.5}
                value={weightKg}
                onChange={(event) => setWeightKg(Number(event.target.value) || 0)}
              />
            </label>
          </>
        ) : null}

        <div className={styles.setActionRow}>
          {setCounterText ? <p className={styles.setCounter}>{setCounterText}</p> : null}
          <button
            type="button"
            className={styles.completeSet}
            onClick={isWorkoutSetsComplete ? handleFinish : handleCompleteSet}
            disabled={!isWorkoutSetsComplete && !currentExercise}
          >
            {isWorkoutSetsComplete
              ? copy.guided.finishWorkoutAndCoolDown
              : copy.guided.completeSet}
          </button>
        </div>
      </article>

      <article className={styles.timerCard}>
        <h3>{copy.guided.restTimer}</h3>
        <p className={styles.timerValue}>
          {formatDistanceStrict(0, restSecLeft * 1000, {
            unit: 'second',
            locale: dateLocale,
          })}
        </p>
        <div className={styles.timerActions}>
          <button
            type="button"
            onClick={() => updateTimer(restSecLeft, !timerPaused)}
            disabled={restSecLeft <= 0}
          >
            {timerPaused ? copy.guided.resume : copy.guided.pause}
          </button>
          <button type="button" onClick={() => updateTimer(addGuidedRestIncrement(restSecLeft), false)}>
            +{GUIDED_REST_INCREMENT_SEC}s
          </button>
          <button type="button" onClick={() => updateTimer(0, true)}>
            {copy.guided.reset}
          </button>
        </div>
      </article>

      <label className={styles.notes}>
        {copy.guided.sessionNotes}
        <textarea
          rows={3}
          placeholder={copy.guided.sessionNotesPlaceholder}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.finish}
          onClick={handleFinish}
          disabled={setLogs.length === 0 || isSubmitting}
        >
          {isSubmitting ? copy.common.saving : copy.guided.finishWorkout}
        </button>
      </footer>

      <Modal
        title={copy.guided.summaryTitle}
        isOpen={completionPreview !== null}
        onClose={() => {
          if (isSubmitting) {
            return
          }

          setCompletionPreview(null)
        }}
        closeLabel={copy.common.close}
      >
        {completionPreview ? (
          <>
            <dl className={styles.summaryList}>
              <div className={styles.summaryRow}>
                <dt>{copy.guided.summaryDuration}</dt>
                <dd>
                  {copy.guided.summaryDurationValue(
                    completionPreview.summary.totalDurationMin,
                  )}
                </dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>{copy.guided.summarySets}</dt>
                <dd>
                  {copy.guided.setsLogged(
                    completionPreview.summary.setLogs.length,
                    totalSetsTarget,
                  )}
                </dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>{copy.guided.summaryCalories}</dt>
                <dd>{copy.details.estimatedCalories(completionPreview.estimatedCalories)}</dd>
              </div>
            </dl>
            <div className={styles.summaryActions}>
              <button
                type="button"
                className={styles.summaryBack}
                onClick={() => setCompletionPreview(null)}
                disabled={isSubmitting}
              >
                {copy.guided.summaryBack}
              </button>
              <button
                type="button"
                className={styles.finish}
                onClick={handleConfirmFinish}
                disabled={isSubmitting}
              >
                {isSubmitting ? copy.common.saving : copy.guided.summaryConfirm}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  )
}
