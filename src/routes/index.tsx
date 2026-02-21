import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { parseISO } from 'date-fns'
import gsap from 'gsap'
import { z } from 'zod'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppHeader } from '@/components/AppHeader'
import { AppFooterControls } from '@/components/AppFooterControls'
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
  clearDataAfterDate,
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
import { getCopy, type AppLanguage } from '@/lib/i18n'
import type { ActiveSessionDraft, SessionPlan, Workout } from '@/lib/types'

import styles from './index.module.css'

const searchSchema = z.object({
  view: z.enum(['calendar', 'graph']).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  types: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  session: z.string().optional(),
})

const themeStorageKey = 'workout-tracker-theme'
const languageStorageKey = 'workout-tracker-language'
const themeMetaLight = '#13212f'
const themeMetaDark = '#0f161d'

type ThemeMode = 'light' | 'dark'

function getPreferredTheme(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey)
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }
  } catch {
    // Keep default when storage is unavailable.
  }

  return 'dark'
}

function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'en'
  }

  try {
    const storedLanguage = window.localStorage.getItem(languageStorageKey)
    if (storedLanguage === 'en' || storedLanguage === 'sv') {
      return storedLanguage
    }
  } catch {
    // Keep default when storage is unavailable.
  }

  return 'en'
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? themeMetaDark : themeMetaLight)
  }
}

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
  const [language, setLanguage] = useState<AppLanguage>(() => getPreferredLanguage())
  const copy = getCopy(language)
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [themeReady, setThemeReady] = useState(false)
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null)
  const [copiedWorkout, setCopiedWorkout] = useState<{
    type: string
    durationMin: number
    targetWeightKg?: number
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
  const canClearAfter = useMemo(
    () =>
      workouts.some((workout) => workout.date > selectedDate) ||
      sessions.some((session) => session.date > selectedDate),
    [selectedDate, sessions, workouts],
  )

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
      setErrorMessage(copy.route.failedInitTypes)
    })
  }, [copy.route.failedInitTypes])

  useEffect(() => {
    const bootTheme = document.documentElement.getAttribute('data-theme')
    if (bootTheme === 'light' || bootTheme === 'dark') {
      setTheme(bootTheme)
    } else {
      setTheme(getPreferredTheme())
    }

    setThemeReady(true)
  }, [])

  useEffect(() => {
    if (!themeReady) {
      return
    }

    applyTheme(theme)

    try {
      window.localStorage.setItem(themeStorageKey, theme)
    } catch {
      // Ignore storage write failures.
    }
  }, [theme, themeReady])

  useEffect(() => {
    document.documentElement.lang = language

    try {
      window.localStorage.setItem(languageStorageKey, language)
    } catch {
      // Ignore storage write failures.
    }
  }, [language])

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
      setErrorMessage(copy.route.failedGenerateSessions)
    })
  }, [activeTemplateId, copy.route.failedGenerateSessions, month])

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

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
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
      setErrorMessage(copy.route.saveWorkoutError)
    }
  }

  const handleDelete = async (workoutId: string) => {
    const confirmed = window.confirm(copy.route.confirmDeleteWorkout)
    if (!confirmed) {
      return
    }

    try {
      await deleteWorkout(workoutId)
    } catch {
      setErrorMessage(copy.route.deleteWorkoutError)
    }
  }

  const handleClearAfter = async (date: string) => {
    const confirmed = window.confirm(copy.route.confirmClearAfterDate(date))
    if (!confirmed) {
      return
    }

    try {
      const { sessionsDeleted, workoutsDeleted } = await clearDataAfterDate(date)
      const selectedSession = search.session
        ? sessions.find((session) => session.id === search.session)
        : undefined
      const previewSession = previewSessionId
        ? sessions.find((session) => session.id === previewSessionId)
        : undefined

      if (selectedSession && selectedSession.date > date) {
        setSearch((prev) => ({ ...prev, session: undefined }))
      }

      if (previewSession && previewSession.date > date) {
        setPreviewSessionId(null)
      }

      trackEvent('clear_after_selected_day', {
        date,
        sessionsDeleted,
        workoutsDeleted,
      })
    } catch {
      setErrorMessage(copy.route.clearAfterDateError)
    }
  }

  const handleCopyWorkout = (workout: Workout) => {
    setCopiedWorkout({
      type: workout.type,
      durationMin: workout.durationMin,
      targetWeightKg: workout.targetWeightKg,
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
        targetWeightKg: copiedWorkout.targetWeightKg,
        distanceKm: copiedWorkout.distanceKm,
        intensity: copiedWorkout.intensity,
        notes: copiedWorkout.notes,
      })
      setSearch((prev) => ({ ...prev, date }))
    } catch {
      setErrorMessage(copy.route.pasteWorkoutError)
    }
  }

  const handleCopyToNextWeek = async (workout: Workout) => {
    const nextWeekDate = addDaysIso(workout.date, 7)

    try {
      await addWorkout({
        date: nextWeekDate,
        type: workout.type,
        durationMin: workout.durationMin,
        targetWeightKg: workout.targetWeightKg,
        distanceKm: workout.distanceKm,
        intensity: workout.intensity,
        notes: workout.notes,
      })
      setSearch((prev) => ({ ...prev, date: nextWeekDate }))
      trackEvent('workout_copied_to_next_week', { workoutId: workout.id })
    } catch {
      setErrorMessage(copy.route.copyToNextWeekError)
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
      setErrorMessage(copy.route.importTemplateError)
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
      setErrorMessage(copy.route.startGuidedError)
    }
  }

  const handlePreviewSession = async (sessionId: string) => {
    try {
      await getOrCreateSessionPlan(sessionId)
      setPreviewSessionId(sessionId)
    } catch {
      setErrorMessage(copy.route.openPlanEditorError)
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
      const workoutLabel = planDay?.label ?? copy.route.fallbackWorkoutLabel

      void sendSkippedWorkoutNotification({
        sessionId,
        date: session.date,
        label: workoutLabel,
        nextDate,
      })

      const shouldMoveToTomorrow = window.confirm(
        copy.route.confirmMoveSkipped(workoutLabel, session.date, nextDate),
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
          setErrorMessage(copy.route.moveSessionError)
        }
      }
    } catch {
      setErrorMessage(copy.route.skipSessionError)
    }
  }

  const handleResetSession = async (sessionId: string) => {
    const confirmed = window.confirm(copy.route.confirmResetSession)
    if (!confirmed) {
      return
    }

    try {
      await resetCompletedSession(sessionId)
    } catch {
      setErrorMessage(copy.route.resetSessionError)
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

    const confirmed = window.confirm(copy.route.confirmAbortSession)
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
          language={language}
          onViewChange={handleChangeView}
          onOpenCreateWorkout={() => handleOpenCreate(selectedDate)}
          onImportTemplate={handleImportTemplate}
          importingTemplate={importingTemplate}
        />

        <FilterBar
          language={language}
          selectedTypeIds={selectedTypeIds}
          types={workoutTypes}
          onChange={handleFilterChange}
        />

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
        {showLoading ? <p className={styles.loading}>{copy.route.loadingWorkouts}</p> : null}

        <div className={styles.main} ref={viewRef}>
          {view === 'calendar' ? (
            <div className={styles.calendarLayout}>
              <CalendarView
                language={language}
                month={month}
                model={calendarModel}
                selectedDate={selectedDate}
                onDaySelect={(date) => setSearch((prev) => ({ ...prev, date }))}
                onMonthChange={handleMonthChange}
              />

              {selectedDay ? (
                <WorkoutDetailPanel
                  language={language}
                  date={selectedDay.date}
                  workouts={selectedDay.workouts}
                  scheduledSessions={selectedDay.sessions}
                  workoutTypes={workoutTypes}
                  planDays={planDays}
                  onCreate={handleOpenCreate}
                  onPasteWorkout={handlePasteWorkout}
                  canPasteWorkout={copiedWorkout !== null}
                  canClearAfter={canClearAfter}
                  onClearAfter={handleClearAfter}
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
                <section className={styles.emptyState}>{copy.route.selectDate}</section>
              )}
            </div>
          ) : (
            <div className={styles.fullWidth}>
              <GraphView
                language={language}
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
              language={language}
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
          <section className={styles.error}>{copy.route.guidedNotReady}</section>
        ) : null}

        {workouts.length === 0 && sessions.length === 0 ? (
          <section className={styles.emptyState}>
            <p>{copy.route.emptyStateIntro}</p>
          </section>
        ) : null}

        <AppFooterControls
          language={language}
          theme={theme}
          onLanguageChange={setLanguage}
          onToggleTheme={handleToggleTheme}
        />
      </div>

      <Modal
        title={
          modalState?.mode === 'edit'
            ? copy.route.editWorkoutTitle
            : copy.route.addWorkoutTitle
        }
        isOpen={modalState !== null}
        onClose={() => setModalState(null)}
        closeLabel={copy.common.close}
      >
        {modalState ? (
          <WorkoutForm
            language={language}
            initialValue={modalState.mode === 'edit' ? modalState.workout : undefined}
            defaultDate={modalState.mode === 'create' ? modalState.date : selectedDate}
            types={workoutTypes}
            onSubmit={saveWorkout}
            onCancel={() => setModalState(null)}
          />
        ) : null}
      </Modal>

      <Modal
        title={copy.route.previewPlanTitle}
        isOpen={previewSessionId !== null}
        onClose={() => setPreviewSessionId(null)}
        closeLabel={copy.common.close}
      >
        {previewPlan ? (
          <SessionPlanEditor
            language={language}
            plan={previewPlan}
            onSave={handleSaveSessionPlan}
            onCancel={() => setPreviewSessionId(null)}
          />
        ) : (
          <p className={styles.loading}>{copy.route.loadingPlan}</p>
        )}
      </Modal>
    </main>
  )
}
