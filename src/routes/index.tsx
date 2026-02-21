import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { parseISO } from 'date-fns'
import gsap from 'gsap'
import { z } from 'zod'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppHeader } from '@/components/AppHeader'
import { CalendarView } from '@/components/CalendarView'
import { FilterBar } from '@/components/FilterBar'
import { GraphView } from '@/components/GraphView'
import { GuidedWorkoutView } from '@/components/GuidedWorkoutView'
import { Modal } from '@/components/Modal'
import { SessionPlanEditor } from '@/components/SessionPlanEditor'
import { WorkoutDetailPanel } from '@/components/WorkoutDetailPanel'
import { WorkoutForm, type WorkoutFormValue } from '@/components/WorkoutForm'
import {
  activeSessionDraftsCollection,
  addWorkout,
  beginGuidedSession,
  completeGuidedSession,
  deleteWorkout,
  ensureDefaultWorkoutTypes,
  exerciseTemplatesCollection,
  generateScheduleForRange,
  getOrCreateSessionPlan,
  importStarterTemplate,
  planDaysCollection,
  planTemplatesCollection,
  resetCompletedSession,
  saveGuidedSessionDraft,
  scheduledSessionsCollection,
  sessionPlansCollection,
  skipScheduledSession,
  moveScheduledSessionToDate,
  updateSessionPlan,
  updateWorkout,
  workoutTypesCollection,
  workoutsCollection,
} from '@/lib/db'
import { addDaysIso, addMonthOffset, todayIso, toDateIso } from '@/lib/date'
import { sendSkippedWorkoutNotification } from '@/lib/notifications'
import {
  getCalendarMonthModel,
  getDefaultMonth,
  getWeeklyTrendSeries,
  monthRange,
} from '@/lib/selectors'
import { trackEvent } from '@/lib/telemetry'
import { useReducedMotion } from '@/lib/useReducedMotion'
import type { ActiveSessionDraft, SessionPlan, Workout } from '@/lib/types'

import styles from './index.module.css'

const searchSchema = z.object({
  view: z.enum(['calendar', 'graph']).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  types: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  session: z.string().optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: (search) => searchSchema.parse(search),
  component: WorkoutDashboard,
})

function WorkoutDashboard() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const reducedMotion = useReducedMotion()

  const workoutsQuery = useLiveQuery(workoutsCollection)
  const typesQuery = useLiveQuery(workoutTypesCollection)
  const templatesQuery = useLiveQuery(planTemplatesCollection)
  const planDaysQuery = useLiveQuery(planDaysCollection)
  const exerciseQuery = useLiveQuery(exerciseTemplatesCollection)
  const sessionsQuery = useLiveQuery(scheduledSessionsCollection)
  const draftQuery = useLiveQuery(activeSessionDraftsCollection)
  const sessionPlansQuery = useLiveQuery(sessionPlansCollection)

  const workouts = workoutsQuery.data ?? []
  const workoutTypes = typesQuery.data ?? []
  const templates = templatesQuery.data ?? []
  const planDays = planDaysQuery.data ?? []
  const exercises = exerciseQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const drafts = (draftQuery.data ?? []) as ActiveSessionDraft[]
  const sessionPlans = (sessionPlansQuery.data ?? []) as SessionPlan[]

  const month = search.month ?? getDefaultMonth(workouts)
  const selectedDate = search.date ?? todayIso()
  const view = search.view ?? 'calendar'
  const selectedTypeIds = useMemo(
    () => (search.types ? search.types.split(',').filter(Boolean) : []),
    [search.types],
  )

  const [modalState, setModalState] = useState<
    | { mode: 'create'; date: string }
    | { mode: 'edit'; workout: Workout }
    | null
  >(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [importingTemplate, setImportingTemplate] = useState(false)
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null)
  const [copiedWorkout, setCopiedWorkout] = useState<{
    type: string
    durationMin: number
    distanceKm?: number
    intensity?: 'low' | 'medium' | 'high'
    notes?: string
  } | null>(null)

  const viewRef = useRef<HTMLDivElement | null>(null)

  const activeTemplateId = templates[0]?.id

  const calendarModel = useMemo(
    () =>
      getCalendarMonthModel({
        month,
        workouts,
        sessions,
        typeIds: selectedTypeIds,
      }),
    [month, workouts, sessions, selectedTypeIds],
  )

  const selectedDay =
    calendarModel.find((day) => day.date === selectedDate) ?? calendarModel[0]

  const weeklySeries = useMemo(
    () =>
      getWeeklyTrendSeries({
        workouts,
        month,
        typeIds: selectedTypeIds,
      }),
    [workouts, month, selectedTypeIds],
  )

  const activeSession = search.session
    ? sessions.find((session) => session.id === search.session)
    : undefined
  const activeDraft = search.session
    ? drafts.find((draft) => draft.sessionId === search.session)
    : undefined

  const activePlanDay = activeSession
    ? planDays.find((day) => day.id === activeSession.planDayId)
    : undefined

  const activeSessionPlan = activeSession
    ? sessionPlans.find((plan) => plan.sessionId === activeSession.id)
    : undefined

  const activeExercises = activeSessionPlan
    ? activeSessionPlan.exercises.map((exercise) => ({
        ...exercise,
        planDayId: activePlanDay?.id ?? 'custom_plan_day',
      }))
    : activePlanDay
      ? exercises.filter((exercise) => exercise.planDayId === activePlanDay.id)
      : []

  const previewPlan = previewSessionId
    ? sessionPlans.find((plan) => plan.sessionId === previewSessionId)
    : undefined

  useEffect(() => {
    ensureDefaultWorkoutTypes().catch(() => {
      setErrorMessage('Failed to initialize workout types.')
    })
  }, [])

  useEffect(() => {
    if (!activeTemplateId) {
      return
    }

    const range = monthRange(month)
    generateScheduleForRange({
      templateId: activeTemplateId,
      from: range.from,
      to: range.to,
    }).catch(() => {
      setErrorMessage('Failed to generate scheduled sessions.')
    })
  }, [activeTemplateId, month])

  useEffect(() => {
    if (!reducedMotion && viewRef.current) {
      gsap.fromTo(
        viewRef.current,
        { autoAlpha: 0, x: view === 'graph' ? 16 : -16 },
        { autoAlpha: 1, x: 0, duration: 0.32, ease: 'power2.out' },
      )
    }
  }, [view, reducedMotion])

  useEffect(() => {
    if (!search.month) {
      navigate({
        replace: true,
        search: (prev) => ({ ...prev, month }),
      })
    }
  }, [month, navigate, search.month])

  useEffect(() => {
    if (!search.date) {
      navigate({
        replace: true,
        search: (prev) => ({ ...prev, date: selectedDate }),
      })
    }
  }, [navigate, search.date, selectedDate])

  const setSearch = (updater: (prev: typeof search) => typeof search) => {
    navigate({ search: updater })
  }

  const handleChangeView = (nextView: 'calendar' | 'graph') => {
    setSearch((prev) => ({ ...prev, view: nextView }))

    if (nextView === 'graph') {
      trackEvent('graph_view_opened', { month })
    }
  }

  const handleMonthChange = (offset: number) => {
    const nextMonth = addMonthOffset(month, offset)
    setSearch((prev) => ({ ...prev, month: nextMonth }))
  }

  const handleFilterChange = (nextTypeIds: string[]) => {
    const encoded = nextTypeIds.length > 0 ? nextTypeIds.sort().join(',') : undefined
    setSearch((prev) => ({ ...prev, types: encoded }))
    trackEvent('filter_used', { typeIds: nextTypeIds })
  }

  const handleOpenCreate = (date = selectedDate) => {
    setModalState({ mode: 'create', date })
  }

  const handleEdit = (workout: Workout) => {
    setModalState({ mode: 'edit', workout })
  }

  const saveWorkout = async (value: WorkoutFormValue) => {
    setErrorMessage(null)

    try {
      if (modalState?.mode === 'edit') {
        await updateWorkout(modalState.workout.id, value)
      } else {
        await addWorkout(value)
      }

      trackEvent('workout_save_success', { mode: modalState?.mode ?? 'create' })
      setModalState(null)
      setSearch((prev) => ({ ...prev, date: value.date }))
    } catch (error) {
      trackEvent('workout_save_error', { message: (error as Error).message })
      setErrorMessage('Unable to save workout. Please try again.')
    }
  }

  const handleDelete = async (workoutId: string) => {
    const confirmed = window.confirm('Delete this workout?')
    if (!confirmed) {
      return
    }

    try {
      await deleteWorkout(workoutId)
    } catch {
      setErrorMessage('Unable to delete workout.')
    }
  }

  const handleCopyWorkout = (workout: Workout) => {
    setCopiedWorkout({
      type: workout.type,
      durationMin: workout.durationMin,
      distanceKm: workout.distanceKm,
      intensity: workout.intensity,
      notes: workout.notes,
    })
    trackEvent('workout_copied', { workoutId: workout.id })
  }

  const handlePasteWorkout = async (date: string) => {
    if (!copiedWorkout) {
      return
    }

    try {
      await addWorkout({
        date,
        type: copiedWorkout.type,
        durationMin: copiedWorkout.durationMin,
        distanceKm: copiedWorkout.distanceKm,
        intensity: copiedWorkout.intensity,
        notes: copiedWorkout.notes,
      })
      setSearch((prev) => ({ ...prev, date }))
    } catch {
      setErrorMessage('Unable to paste workout.')
    }
  }

  const handleCopyToNextWeek = async (workout: Workout) => {
    const nextWeekDate = addDaysIso(workout.date, 7)

    try {
      await addWorkout({
        date: nextWeekDate,
        type: workout.type,
        durationMin: workout.durationMin,
        distanceKm: workout.distanceKm,
        intensity: workout.intensity,
        notes: workout.notes,
      })
      setSearch((prev) => ({ ...prev, date: nextWeekDate }))
      trackEvent('workout_copied_to_next_week', { workoutId: workout.id })
    } catch {
      setErrorMessage('Unable to copy workout to next week.')
    }
  }

  const handleImportTemplate = async () => {
    setImportingTemplate(true)
    setErrorMessage(null)

    try {
      await importStarterTemplate()
      if (templates[0]?.id) {
        const range = monthRange(month)
        await generateScheduleForRange({
          templateId: templates[0].id,
          from: range.from,
          to: range.to,
        })
      }
      trackEvent('starter_template_imported')
    } catch {
      setErrorMessage('Could not import starter template.')
    } finally {
      setImportingTemplate(false)
    }
  }

  const handleStartSession = async (sessionId: string) => {
    setErrorMessage(null)

    try {
      await getOrCreateSessionPlan(sessionId)
      await beginGuidedSession(sessionId)
      setSearch((prev) => ({ ...prev, session: sessionId }))
    } catch {
      setErrorMessage('Unable to start guided workout.')
    }
  }

  const handlePreviewSession = async (sessionId: string) => {
    try {
      await getOrCreateSessionPlan(sessionId)
      setPreviewSessionId(sessionId)
    } catch {
      setErrorMessage('Unable to open session plan editor.')
    }
  }

  const handleSkipSession = async (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId)

    try {
      await skipScheduledSession(sessionId)

      if (!session) {
        return
      }

      const nextDate = addDaysIso(session.date, 1)
      const planDay = planDays.find((day) => day.id === session.planDayId)
      const workoutLabel = planDay?.label ?? 'Workout'

      void sendSkippedWorkoutNotification({
        sessionId,
        date: session.date,
        label: workoutLabel,
        nextDate,
      })

      const shouldMoveToTomorrow = window.confirm(
        `${workoutLabel} was skipped on ${session.date}. Move it to ${nextDate}?`,
      )

      if (shouldMoveToTomorrow) {
        try {
          const movedSessionId = await moveScheduledSessionToDate(sessionId, nextDate)
          setSearch((prev) => ({
            ...prev,
            date: nextDate,
            session: prev.session === sessionId ? movedSessionId : prev.session,
          }))
        } catch {
          setErrorMessage('Unable to move session to next day.')
        }
      }
    } catch {
      setErrorMessage('Unable to skip session.')
    }
  }

  const handleResetSession = async (sessionId: string) => {
    const confirmed = window.confirm(
      'Reset this completed session? Linked workout data will be removed from totals.',
    )
    if (!confirmed) {
      return
    }

    try {
      await resetCompletedSession(sessionId)
    } catch {
      setErrorMessage('Unable to reset session.')
    }
  }

  const handleCompleteSession = async (summary: Parameters<typeof completeGuidedSession>[0]['summary'], notes?: string) => {
    if (!activeSession) {
      return
    }

    await completeGuidedSession({
      sessionId: activeSession.id,
      summary,
      notes,
    })

    setSearch((prev) => ({ ...prev, session: undefined, date: activeSession.date }))
  }

  const handleAbortSession = async () => {
    if (!activeSession) {
      return
    }

    const confirmed = window.confirm(
      'End this guided session and mark it as skipped?',
    )
    if (!confirmed) {
      return
    }

    await skipScheduledSession(activeSession.id)
    setSearch((prev) => ({ ...prev, session: undefined }))
  }

  const handleSaveDraft = async (
    updater: Parameters<typeof saveGuidedSessionDraft>[1],
  ) => {
    if (!activeSession) {
      return
    }

    await saveGuidedSessionDraft(activeSession.id, updater)
  }

  const handleSaveSessionPlan = async (nextPlan: SessionPlan) => {
    await updateSessionPlan(nextPlan.sessionId, () => nextPlan)
    setPreviewSessionId(null)
  }

  const handleSwapExerciseVariant = async (
    exerciseIndex: number,
    nextName: string,
  ) => {
    if (!activeSession) {
      return
    }

    await updateSessionPlan(activeSession.id, (plan) => ({
      ...plan,
      exercises: plan.exercises.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, name: nextName } : exercise,
      ),
    }))
  }

  const showLoading =
    workoutsQuery.isLoading ||
    typesQuery.isLoading ||
    sessionsQuery.isLoading ||
    planDaysQuery.isLoading ||
    exerciseQuery.isLoading ||
    sessionPlansQuery.isLoading

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <AppHeader
          view={view}
          onViewChange={handleChangeView}
          onOpenCreateWorkout={() => handleOpenCreate(selectedDate)}
          onImportTemplate={handleImportTemplate}
          importingTemplate={importingTemplate}
        />

        <FilterBar
          selectedTypeIds={selectedTypeIds}
          types={workoutTypes}
          onChange={handleFilterChange}
        />

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
        {showLoading ? <p className={styles.loading}>Loading your workouts...</p> : null}

        <div className={styles.main} ref={viewRef}>
          {view === 'calendar' ? (
            <div className={styles.calendarLayout}>
              <CalendarView
                month={month}
                model={calendarModel}
                selectedDate={selectedDate}
                onDaySelect={(date) => setSearch((prev) => ({ ...prev, date }))}
                onMonthChange={handleMonthChange}
              />

              {selectedDay ? (
                <WorkoutDetailPanel
                  date={selectedDay.date}
                  workouts={selectedDay.workouts}
                  scheduledSessions={selectedDay.sessions}
                  workoutTypes={workoutTypes}
                  planDays={planDays}
                  onCreate={handleOpenCreate}
                  onPasteWorkout={handlePasteWorkout}
                  canPasteWorkout={copiedWorkout !== null}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onCopyWorkout={handleCopyWorkout}
                  onCopyToNextWeek={handleCopyToNextWeek}
                  onStartWorkout={handleStartSession}
                  onSkipSession={handleSkipSession}
                  onPreviewSession={handlePreviewSession}
                  onResetSession={handleResetSession}
                />
              ) : (
                <section className={styles.emptyState}>Select a date.</section>
              )}
            </div>
          ) : (
            <div className={styles.fullWidth}>
              <GraphView
                series={weeklySeries}
                workouts={workouts}
                workoutTypes={workoutTypes}
                selectedTypeIds={selectedTypeIds}
                onPointSelect={(weekStart) => {
                  const targetDate = toDateIso(parseISO(weekStart))
                  setSearch((prev) => ({ ...prev, date: targetDate, view: 'calendar' }))
                }}
              />
            </div>
          )}
        </div>

        {activeSession && activeDraft ? (
          <section className={styles.floatingCard}>
            <GuidedWorkoutView
              session={activeSession}
              planDay={activePlanDay}
              exercises={activeExercises}
              draft={activeDraft}
              onSaveDraft={handleSaveDraft}
              onComplete={handleCompleteSession}
              onAbort={handleAbortSession}
              onSwapExerciseVariant={handleSwapExerciseVariant}
            />
          </section>
        ) : null}

        {search.session && !activeDraft ? (
          <section className={styles.error}>
            Guided session is not ready. Try re-opening it from the calendar day panel.
          </section>
        ) : null}

        {workouts.length === 0 && sessions.length === 0 ? (
          <section className={styles.emptyState}>
            <p>
              Start by importing the 4-day template or adding your first completed
              workout.
            </p>
          </section>
        ) : null}
      </div>

      <Modal
        title={modalState?.mode === 'edit' ? 'Edit workout' : 'Add workout'}
        isOpen={modalState !== null}
        onClose={() => setModalState(null)}
      >
        {modalState ? (
          <WorkoutForm
            initialValue={modalState.mode === 'edit' ? modalState.workout : undefined}
            defaultDate={modalState.mode === 'create' ? modalState.date : selectedDate}
            types={workoutTypes}
            onSubmit={saveWorkout}
            onCancel={() => setModalState(null)}
          />
        ) : null}
      </Modal>

      <Modal
        title="Preview / Edit Session Plan"
        isOpen={previewSessionId !== null}
        onClose={() => setPreviewSessionId(null)}
      >
        {previewPlan ? (
          <SessionPlanEditor
            plan={previewPlan}
            onSave={handleSaveSessionPlan}
            onCancel={() => setPreviewSessionId(null)}
          />
        ) : (
          <p className={styles.loading}>Loading plan...</p>
        )}
      </Modal>
    </main>
  )
}
