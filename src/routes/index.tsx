import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { parseISO } from 'date-fns'
import gsap from 'gsap'
import { z } from 'zod'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppFooterControls } from '@/components/AppFooterControls'
import { AppHeader } from '@/components/AppHeader'
import { CalendarView } from '@/components/CalendarView'
import { FilterBar } from '@/components/FilterBar'
import { ExerciseHistoryView, type ExerciseViewFilters } from '@/components/ExerciseHistoryView'
import { GraphView } from '@/components/GraphView'
import { GuidedWorkoutView } from '@/components/GuidedWorkoutView'
import { Modal } from '@/components/Modal'
import { SessionPlanEditor } from '@/components/SessionPlanEditor'
import { TemplateEditor, createDefaultTemplateDays } from '@/components/TemplateEditor'
import { WorkoutDetailPanel } from '@/components/WorkoutDetailPanel'
import { WorkoutForm, type WorkoutFormValue } from '@/components/WorkoutForm'
import {
  addExerciseCatalogEntry,
  activeSessionDraftsCollection,
  applyTemplateToCalendar,
  beginGuidedSession,
  clearAllUncompletedSessions,
  completeGuidedSession,
  clearDataAfterDate,
  clearDataBeforeDate,
  createPlanTemplate,
  deletePlanTemplate,
  deleteWorkout,
  ensureDefaultWorkoutTypes,
  ensureDefaultExerciseCatalog,
  exerciseCatalogCollection,
  exerciseTemplatesCollection,
  generateScheduleForRange,
  getOrCreateSessionPlan,
  importStarterTemplate,
  LAST_TEMPLATE_DELETE_ERROR,
  MIN_TEMPLATE_COUNT,
  planDaysCollection,
  planTemplatesCollection,
  MANUAL_TEMPLATE_ID,
  resetCompletedSession,
  saveGuidedSessionDraft,
  scheduledSessionsCollection,
  sessionPlansCollection,
  skipScheduledSession,
  moveScheduledSessionToDate,
  duplicateScheduledSession,
  planManualWorkout,
  updateSessionPlan,
  updatePlanTemplate,
  updateWorkout,
  workoutTypesCollection,
  workoutsCollection,
} from '@/lib/db'
import { addDaysIso, addMonthOffset, todayIso, toDateIso } from '@/lib/date'
import { STARTER_TEMPLATE_ID } from '@/lib/templates'
import { sendSkippedWorkoutNotification } from '@/lib/notifications'
import {
  getCalendarMonthModel,
  getDefaultMonth,
  getExerciseHistory,
  getLatestWeightByExerciseName,
  getWeeklyTrendSeries,
  monthRange,
} from '@/lib/selectors'
import { trackEvent } from '@/lib/telemetry'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { getCopy, type AppLanguage } from '@/lib/i18n'
import type { ActiveSessionDraft, SessionPlan, Workout } from '@/lib/types'

import styles from './index.module.css'

type DashboardView = 'calendar' | 'graph' | 'exercises'

const searchSchema = z.object({
  view: z.enum(['calendar', 'graph', 'exercises', 'history']).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  types: z.string().optional(),
  exMuscle: z.string().optional(),
  exEquipment: z.string().optional(),
  exDifficulty: z.string().optional(),
  exCategory: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  session: z.string().optional(),
  template: z.string().optional(),
})

const themeStorageKey = 'workout-tracker-theme'
const languageStorageKey = 'workout-tracker-language'
const themeMetaLight = '#fbfcff'
const themeMetaDark = '#1a1c24'

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
  const exerciseCatalogQuery = useLiveQuery(exerciseCatalogCollection)
  const sessionsQuery = useLiveQuery(scheduledSessionsCollection)
  const draftQuery = useLiveQuery(activeSessionDraftsCollection)
  const sessionPlansQuery = useLiveQuery(sessionPlansCollection)

  const workouts = workoutsQuery.data ?? []
  const workoutTypes = typesQuery.data ?? []
  const templates = templatesQuery.data ?? []
  const planDays = planDaysQuery.data ?? []
  const exercises = exerciseQuery.data ?? []
  const exerciseCatalog = exerciseCatalogQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const drafts = (draftQuery.data ?? []) as ActiveSessionDraft[]
  const sessionPlans = (sessionPlansQuery.data ?? []) as SessionPlan[]

  const month = search.month ?? getDefaultMonth(workouts)
  const selectedDate = search.date ?? todayIso()
  const view = (search.view === 'history' ? 'exercises' : search.view ?? 'calendar') as DashboardView
  const selectedTypeIds = useMemo(
    () => (search.types ? search.types.split(',').filter(Boolean) : []),
    [search.types],
  )
  const selectedExerciseFilters = useMemo<ExerciseViewFilters>(
    () => ({
      muscle: search.exMuscle,
      equipment: search.exEquipment,
      difficulty: search.exDifficulty,
      category: search.exCategory,
    }),
    [search.exCategory, search.exDifficulty, search.exEquipment, search.exMuscle],
  )
  const setSearch = (updater: (prev: typeof search) => typeof search) => {
    navigate({
      search: (prev) => {
        const next = updater(prev)
        const normalizedView = next.view === 'history' ? 'exercises' : next.view

        if (normalizedView === 'exercises') {
          return {
            view: 'exercises',
            types: next.types || undefined,
            exMuscle: next.exMuscle || undefined,
            exEquipment: next.exEquipment || undefined,
            exDifficulty: next.exDifficulty || undefined,
            exCategory: next.exCategory || undefined,
          }
        }

        if (normalizedView === 'graph') {
          return {
            view: 'graph',
            month: next.month,
            types: next.types || undefined,
          }
        }

        const calendarMonth = next.month ?? getDefaultMonth(workouts)
        const calendarDate = next.date ?? todayIso()

        return {
          view: undefined,
          month: calendarMonth === getDefaultMonth(workouts) ? undefined : calendarMonth,
          date: calendarDate === todayIso() ? undefined : calendarDate,
          types: next.types || undefined,
          session: next.session,
          template: next.template,
        }
      },
    })
  }

  const [modalState, setModalState] = useState<
    | { mode: 'create'; date: string }
    | { mode: 'edit'; workout: Workout }
    | null
  >(null)
  const [templateModalState, setTemplateModalState] = useState<
    | { mode: 'create'; startDate: string }
    | {
        mode: 'duplicate'
        sourceTemplateId?: string
        startDate: string
        allowSourceSelection: boolean
      }
    | { mode: 'edit'; templateId: string }
    | null
  >(null)
  const [applyTemplateModalState, setApplyTemplateModalState] = useState<{
    startPlanDayId: string
  } | null>(null)
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [language, setLanguage] = useState<AppLanguage>(() => getPreferredLanguage())
  const copy = getCopy(language)
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [themeReady, setThemeReady] = useState(false)
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null)
  const [copiedWorkout, setCopiedWorkout] = useState<{
    scheduledSessionId?: string
    type: string
    durationMin: number
    targetWeightKg?: number
    distanceKm?: number
    intensity?: 'low' | 'medium' | 'high'
    notes?: string
  } | null>(null)
  const isSavingTemplateRef = useRef(false)

  const viewRef = useRef<HTMLDivElement | null>(null)

  const activeTemplateId = useMemo(() => {
    if (templates.length === 0) {
      return undefined
    }

    if (search.template && templates.some((template) => template.id === search.template)) {
      return search.template
    }

    return (
      templates.find((template) => template.id === STARTER_TEMPLATE_ID)?.id ??
      templates[0]?.id
    )
  }, [search.template, templates])
  const activeTemplate = templates.find((template) => template.id === activeTemplateId)
  const activeTemplateDays = useMemo(
    () =>
      activeTemplateId
        ? planDays
            .filter((day) => day.templateId === activeTemplateId)
            .sort((a, b) => a.weekday - b.weekday)
        : [],
    [activeTemplateId, planDays],
  )
  const visibleSessions = useMemo(() => {
    if (!activeTemplateId) {
      return sessions
    }

    return sessions.filter(
      (session) =>
        session.templateId === activeTemplateId || session.templateId === MANUAL_TEMPLATE_ID,
    )
  }, [activeTemplateId, sessions])

  const calendarModel = useMemo(
    () =>
      getCalendarMonthModel({
        month,
        workouts,
        sessions: visibleSessions,
        typeIds: selectedTypeIds,
      }),
    [month, workouts, visibleSessions, selectedTypeIds],
  )

  const selectedDay =
    calendarModel.find((day) => day.date === selectedDate) ?? calendarModel[0]
  const canClearAfter = useMemo(
    () =>
      visibleSessions.some(
        (session) => session.status !== 'completed' && session.date > selectedDate,
      ),
    [selectedDate, visibleSessions],
  )
  const canClearBefore = useMemo(
    () =>
      visibleSessions.some(
        (session) => session.status !== 'completed' && session.date < selectedDate,
      ),
    [selectedDate, visibleSessions],
  )
  const canClearAllUncompleted = useMemo(
    () => sessions.some((session) => session.status !== 'completed'),
    [sessions],
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
  const isWorkoutMode = search.session !== undefined

  const activeExercises = activeSessionPlan
    ? activeSessionPlan.exercises.map((exercise) => ({
        ...exercise,
        planDayId: activePlanDay?.id ?? 'custom_plan_day',
      }))
    : activePlanDay
      ? exercises.filter((exercise) => exercise.planDayId === activePlanDay.id)
      : []

  const exerciseHistory = useMemo(() => getExerciseHistory(workouts), [workouts])
  const latestWeightByExerciseName = useMemo(
    () => getLatestWeightByExerciseName(workouts),
    [workouts],
  )
  const templateExerciseSuggestions = useMemo(() => {
    const names = new Set<string>()

    for (const entry of exerciseCatalog) {
      const trimmed = entry.name.trim()
      if (trimmed) {
        names.add(trimmed)
      }
    }

    for (const exercise of exercises) {
      const trimmed = exercise.name.trim()
      if (trimmed) {
        names.add(trimmed)
      }
    }

    for (const plan of sessionPlans) {
      for (const exercise of plan.exercises) {
        const trimmed = exercise.name.trim()
        if (trimmed) {
          names.add(trimmed)
        }
      }
    }

    for (const entry of exerciseHistory) {
      names.add(entry.name)
    }

    return [...names].sort((a, b) => a.localeCompare(b))
  }, [exerciseCatalog, exerciseHistory, exercises, sessionPlans])

  const previewPlan = previewSessionId
    ? sessionPlans.find((plan) => plan.sessionId === previewSessionId)
    : undefined

  useEffect(() => {
    ensureDefaultWorkoutTypes().catch(() => {
      setErrorMessage(copy.route.failedInitTypes)
    })
  }, [copy.route.failedInitTypes])

  useEffect(() => {
    ensureDefaultExerciseCatalog().catch(() => {
      setErrorMessage(copy.route.failedInitTypes)
    })
  }, [copy.route.failedInitTypes])

  useEffect(() => {
    importStarterTemplate().catch(() => {
      setErrorMessage(copy.route.importTemplateError)
    })
  }, [copy.route.importTemplateError])

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
      const offset = view === 'graph' || view === 'exercises' ? 16 : -16
      gsap.fromTo(
        viewRef.current,
        { autoAlpha: 0, x: offset },
        { autoAlpha: 1, x: 0, duration: 0.32, ease: 'power2.out' },
      )
    }
  }, [view, reducedMotion])

  useEffect(() => {
    if (search.view !== 'history') {
      return
    }

    setSearch((prev) => ({ ...prev, view: 'exercises' }))
  }, [search.view])

  useEffect(() => {
    if (view !== 'exercises') {
      return
    }

    if (!search.month && !search.date && !search.template && !search.session) {
      return
    }

    setSearch((prev) => ({ ...prev, view: 'exercises' }))
  }, [search.date, search.month, search.session, search.template, view])

  useEffect(() => {
    if (view !== 'graph') {
      return
    }

    if (!search.date && !search.template && !search.session) {
      return
    }

    setSearch((prev) => ({ ...prev, view: 'graph' }))
  }, [search.date, search.session, search.template, view])

  useEffect(() => {
    if (!activeTemplate || selectedDate >= activeTemplate.startDate) {
      return
    }

    setSearch((prev) => ({
      ...prev,
      date: activeTemplate.startDate,
      month: activeTemplate.startDate.slice(0, 7),
    }))
  }, [activeTemplate, selectedDate])

  useEffect(() => {
    if (!search.session || !activeTemplateId) {
      return
    }

    const selectedSession = sessions.find((session) => session.id === search.session)
    if (!selectedSession || selectedSession.templateId === activeTemplateId) {
      return
    }

    setSearch((prev) => ({ ...prev, session: undefined }))
  }, [activeTemplateId, search.session, sessions])

  const handleChangeView = (nextView: DashboardView) => {
    setSearch((prev) => ({ ...prev, view: nextView }))

    if (nextView === 'graph') {
      trackEvent('graph_view_opened', { month })
    }
    if (nextView === 'exercises') {
      trackEvent('exercises_view_opened', { month })
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

  const handleExerciseFilterChange = (nextFilters: ExerciseViewFilters) => {
    setSearch((prev) => ({
      ...prev,
      exMuscle: nextFilters.muscle || undefined,
      exEquipment: nextFilters.equipment || undefined,
      exDifficulty: nextFilters.difficulty || undefined,
      exCategory: nextFilters.category || undefined,
    }))
  }

  const handleAddExerciseCatalogEntry = async (name: string) => {
    try {
      await addExerciseCatalogEntry(name)
    } catch {
      setErrorMessage(copy.route.saveWorkoutError)
    }
  }

  const getTemplateDaysForEditor = (templateId: string) => {
    const templateDays = planDays
      .filter((day) => day.templateId === templateId)
      .sort((a, b) => a.weekday - b.weekday)

    return templateDays.map((day) => ({
      weekday: day.weekday,
      label: day.label,
      exercises: exercises
        .filter((exercise) => exercise.planDayId === day.id)
        .map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          minReps: exercise.minReps,
          maxReps: exercise.maxReps,
          restSecDefault: exercise.restSecDefault,
        })),
    }))
  }

  const handleTemplateChange = (templateId: string) => {
    setSearch((prev) => ({ ...prev, template: templateId, session: undefined }))
  }

  const handleOpenApplyTemplate = () => {
    if (activeTemplateDays.length === 0) {
      setErrorMessage(copy.route.failedGenerateSessions)
      return
    }

    const selectedWeekday = ((parseISO(selectedDate).getDay() + 6) % 7) + 1
    const preferredDay =
      activeTemplateDays.find((day) => day.weekday === selectedWeekday) ??
      activeTemplateDays[0]

    setApplyTemplateModalState({
      startPlanDayId: preferredDay!.id,
    })
  }

  const handleApplyTemplate = async () => {
    if (!activeTemplateId || !applyTemplateModalState || isApplyingTemplate) {
      return
    }

    setErrorMessage(null)
    setIsApplyingTemplate(true)

    try {
      const targetMonth = selectedDate.slice(0, 7)
      const range = monthRange(targetMonth)

      await applyTemplateToCalendar({
        templateId: activeTemplateId,
        startDate: selectedDate,
        to: range.to,
        startPlanDayId: applyTemplateModalState.startPlanDayId,
      })

      setApplyTemplateModalState(null)
      setSearch((prev) => ({
        ...prev,
        month: targetMonth,
        date: selectedDate,
        session: undefined,
      }))

      trackEvent('template_applied', {
        templateId: activeTemplateId,
        date: selectedDate,
        startPlanDayId: applyTemplateModalState.startPlanDayId,
      })
    } catch {
      setErrorMessage(copy.route.failedGenerateSessions)
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  const handleOpenCreateTemplate = () => {
    setTemplateModalState({
      mode: 'create',
      startDate: selectedDate,
    })
  }

  const handleOpenDuplicateTemplate = (sourceTemplateId?: string) => {
    setTemplateModalState({
      mode: 'duplicate',
      sourceTemplateId: sourceTemplateId ?? activeTemplateId,
      startDate: selectedDate,
      allowSourceSelection: true,
    })
  }

  const handleOpenEditTemplate = (templateId?: string) => {
    const targetTemplateId = templateId ?? activeTemplateId
    if (!targetTemplateId) {
      return
    }

    setTemplateModalState({
      mode: 'edit',
      templateId: targetTemplateId,
    })
  }

  const handleDeleteTemplate = async (templateId: string) => {
    const target = templates.find((template) => template.id === templateId)
    if (!target) {
      return
    }

    if (templates.length <= MIN_TEMPLATE_COUNT) {
      setErrorMessage(copy.route.minTemplatesRequired)
      return
    }

    const confirmed = window.confirm(copy.route.confirmDeleteTemplate(target.name))
    if (!confirmed) {
      return
    }

    try {
      await deletePlanTemplate(templateId)
      setSearch((prev) => ({
        ...prev,
        template: prev.template === templateId ? undefined : prev.template,
        session: undefined,
      }))
      trackEvent('template_deleted', { templateId })
    } catch (error) {
      if (error instanceof Error && error.message === LAST_TEMPLATE_DELETE_ERROR) {
        setErrorMessage(copy.route.minTemplatesRequired)
        return
      }

      setErrorMessage(copy.route.deleteTemplateError)
    }
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
        await planManualWorkout(value)
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

  const handleClearBefore = async (date: string) => {
    const confirmed = window.confirm(copy.route.confirmClearBeforeDate(date))
    if (!confirmed) {
      return
    }

    try {
      const { sessionsDeleted, workoutsDeleted } = await clearDataBeforeDate(date)
      const selectedSession = search.session
        ? sessions.find((session) => session.id === search.session)
        : undefined
      const previewSession = previewSessionId
        ? sessions.find((session) => session.id === previewSessionId)
        : undefined

      if (selectedSession && selectedSession.date < date) {
        setSearch((prev) => ({ ...prev, session: undefined }))
      }

      if (previewSession && previewSession.date < date) {
        setPreviewSessionId(null)
      }

      trackEvent('clear_before_selected_day', {
        date,
        sessionsDeleted,
        workoutsDeleted,
      })
    } catch {
      setErrorMessage(copy.route.clearBeforeDateError)
    }
  }

  const handleClearAllUncompleted = async () => {
    setErrorMessage(null)

    const confirmed = window.confirm(copy.route.confirmClearAllUncompleted)
    if (!confirmed) {
      return
    }

    const selectedSession = search.session
      ? sessions.find((session) => session.id === search.session)
      : undefined
    const previewSession = previewSessionId
      ? sessions.find((session) => session.id === previewSessionId)
      : undefined

    try {
      const { sessionsDeleted } = await clearAllUncompletedSessions()

      if (selectedSession && selectedSession.status !== 'completed') {
        setSearch((prev) => ({ ...prev, session: undefined }))
      }

      if (previewSession && previewSession.status !== 'completed') {
        setPreviewSessionId(null)
      }

      trackEvent('clear_all_uncompleted_sessions', {
        sessionsDeleted,
      })
    } catch {
      setErrorMessage(copy.route.clearAllUncompletedError)
    }
  }

  const handleCopyWorkout = (workout: Workout) => {
    setCopiedWorkout({
      scheduledSessionId: workout.scheduledSessionId,
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
      if (copiedWorkout.scheduledSessionId) {
        await duplicateScheduledSession(copiedWorkout.scheduledSessionId, date)
      } else {
        await planManualWorkout({
          date,
          type: copiedWorkout.type,
          durationMin: copiedWorkout.durationMin,
          targetWeightKg: copiedWorkout.targetWeightKg,
          distanceKm: copiedWorkout.distanceKm,
          intensity: copiedWorkout.intensity,
          notes: copiedWorkout.notes,
        })
      }
      setSearch((prev) => ({ ...prev, date }))
    } catch {
      setErrorMessage(copy.route.pasteWorkoutError)
    }
  }

  const handleCopyToNextWeek = async (workout: Workout) => {
    const nextWeekDate = addDaysIso(workout.date, 7)

    try {
      if (workout.scheduledSessionId) {
        await duplicateScheduledSession(workout.scheduledSessionId, nextWeekDate)
      } else {
        await planManualWorkout({
          date: nextWeekDate,
          type: workout.type,
          durationMin: workout.durationMin,
          targetWeightKg: workout.targetWeightKg,
          distanceKm: workout.distanceKm,
          intensity: workout.intensity,
          notes: workout.notes,
        })
      }
      setSearch((prev) => ({ ...prev, date: nextWeekDate }))
      trackEvent('workout_copied_to_next_week', { workoutId: workout.id })
    } catch {
      setErrorMessage(copy.route.copyToNextWeekError)
    }
  }

  const handleSaveTemplate = async (value: {
    name: string
    startDate: string
    days: Array<{
      weekday: number
      label: string
      exercises: Array<{
        name: string
        sets: number
        minReps?: number
        maxReps?: number
        restSecDefault?: number
      }>
    }>
  }) => {
    if (!templateModalState) {
      return
    }
    if (isSavingTemplateRef.current) {
      return
    }

    setErrorMessage(null)
    isSavingTemplateRef.current = true

    try {
      if (templateModalState.mode === 'edit') {
        await updatePlanTemplate({
          templateId: templateModalState.templateId,
          name: value.name,
          startDate: value.startDate,
          locale: language,
          days: value.days,
        })

        const range = monthRange(month)
        await generateScheduleForRange({
          templateId: templateModalState.templateId,
          from: range.from,
          to: range.to,
        })

        setTemplateModalState(null)
        setSearch((prev) => ({
          ...prev,
          template: templateModalState.templateId,
          date: value.startDate,
          month: value.startDate.slice(0, 7),
          session: undefined,
        }))

        trackEvent('template_updated', {
          templateId: templateModalState.templateId,
        })
      } else {
        const template = await createPlanTemplate({
          name: value.name,
          startDate: value.startDate,
          locale: language,
          days: value.days,
        })

        const range = monthRange(month)
        await generateScheduleForRange({
          templateId: template.id,
          from: range.from,
          to: range.to,
        })

        setTemplateModalState(null)
        setSearch((prev) => ({
          ...prev,
          template: template.id,
          date: value.startDate,
          month: value.startDate.slice(0, 7),
          session: undefined,
        }))

        trackEvent(
          templateModalState.mode === 'duplicate'
            ? 'template_duplicated'
            : 'template_created',
          {
            templateId: template.id,
          },
        )
      }
    } catch {
      setErrorMessage(
        templateModalState.mode === 'duplicate'
          ? copy.route.duplicateTemplateError
          : templateModalState.mode === 'edit'
            ? copy.route.updateTemplateError
            : copy.route.createTemplateError,
      )
    } finally {
      isSavingTemplateRef.current = false
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

  const templateSource =
    templateModalState?.mode === 'duplicate' && templateModalState.sourceTemplateId
      ? templates.find((template) => template.id === templateModalState.sourceTemplateId)
      : templateModalState?.mode === 'edit'
        ? templates.find((template) => template.id === templateModalState.templateId)
        : undefined

  const templateEditorInitialName =
    templateModalState?.mode === 'edit'
      ? templateSource?.name ?? ''
      : templateSource
        ? `${templateSource.name} copy`
        : ''
  const templateEditorInitialStartDate =
    templateModalState?.mode === 'edit'
      ? templateSource?.startDate ?? selectedDate
      : templateModalState?.startDate ?? selectedDate
  const templateEditorInitialDays =
    templateSource ? getTemplateDaysForEditor(templateSource.id) : createDefaultTemplateDays()
  const applyTemplateDayOptions = activeTemplateDays.map((day, index) => ({
    id: day.id,
    label:
      day.label.trim() ||
      `${copy.templateForm.dayLabel} ${index + 1}`,
    weekdayLabel: copy.calendar.weekdayLabels[day.weekday - 1] ?? '',
  }))

  const showLoading =
    workoutsQuery.isLoading ||
    typesQuery.isLoading ||
    templatesQuery.isLoading ||
    sessionsQuery.isLoading ||
    planDaysQuery.isLoading ||
    exerciseQuery.isLoading ||
    exerciseCatalogQuery.isLoading ||
    sessionPlansQuery.isLoading

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {!isWorkoutMode ? (
          <AppHeader
            view={view}
            language={language}
            templates={templates.map((template) => ({
              id: template.id,
              name: template.name,
            }))}
            activeTemplateId={activeTemplateId}
            onViewChange={handleChangeView}
            onTemplateChange={handleTemplateChange}
            onApplyTemplateToCalendar={handleOpenApplyTemplate}
            onOpenCreateTemplate={handleOpenCreateTemplate}
            onOpenEditTemplate={handleOpenEditTemplate}
            onOpenDuplicateTemplate={handleOpenDuplicateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onOpenCreateWorkout={() => handleOpenCreate(selectedDate)}
          />
        ) : null}

        {!isWorkoutMode ? (
          <FilterBar
            language={language}
            selectedTypeIds={selectedTypeIds}
            types={workoutTypes}
            onChange={handleFilterChange}
          />
        ) : null}

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
        {showLoading ? <p className={styles.loading}>{copy.route.loadingWorkouts}</p> : null}

        {!isWorkoutMode ? (
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
                    canClearBefore={canClearBefore}
                    onClearBefore={handleClearBefore}
                    canClearAfter={canClearAfter}
                    onClearAfter={handleClearAfter}
                    canClearAllUncompleted={canClearAllUncompleted}
                    onClearAllUncompleted={handleClearAllUncompleted}
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
            ) : view === 'graph' ? (
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
            ) : (
              <div className={styles.fullWidth}>
                <ExerciseHistoryView
                  language={language}
                  workouts={workouts}
                  selectedTypeIds={selectedTypeIds}
                  selectedFilters={selectedExerciseFilters}
                  onFiltersChange={handleExerciseFilterChange}
                  availableExerciseNames={templateExerciseSuggestions}
                  onAddExercise={handleAddExerciseCatalogEntry}
                />
              </div>
            )}
          </div>
        ) : null}

        {activeSession && activeDraft ? (
          <section
            className={isWorkoutMode ? styles.workoutModeSurface : styles.floatingCard}
          >
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
              latestWeightByExerciseName={latestWeightByExerciseName}
            />
          </section>
        ) : null}

        {search.session && !activeDraft ? (
          <section className={isWorkoutMode ? styles.workoutModeError : styles.error}>
            {copy.route.guidedNotReady}
          </section>
        ) : null}

        {workouts.length === 0 && visibleSessions.length === 0 ? (
          <section className={styles.emptyState}>
            <p>{copy.route.emptyStateIntro}</p>
          </section>
        ) : null}
      </div>

      {!isWorkoutMode ? (
        <AppFooterControls
          language={language}
          theme={theme}
          onLanguageChange={setLanguage}
          onToggleTheme={handleToggleTheme}
        />
      ) : null}

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
        title={copy.route.applyTemplateTitle}
        isOpen={applyTemplateModalState !== null}
        onClose={() => setApplyTemplateModalState(null)}
        closeLabel={copy.common.close}
      >
        {applyTemplateModalState ? (
          <>
            <p>{copy.route.applyTemplateHelp(selectedDate)}</p>
            <label>
              {copy.route.applyTemplateStartDayLabel}
              <select
                value={applyTemplateModalState.startPlanDayId}
                onChange={(event) =>
                  setApplyTemplateModalState((current) =>
                    current
                      ? {
                          ...current,
                          startPlanDayId: event.target.value,
                        }
                      : current,
                  )
                }
              >
                {applyTemplateDayOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({option.weekdayLabel})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button
                type="button"
                onClick={handleApplyTemplate}
                disabled={isApplyingTemplate}
              >
                {copy.route.applyTemplateAction}
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        title={
          templateModalState?.mode === 'duplicate'
            ? copy.route.duplicateTemplateTitle
            : templateModalState?.mode === 'edit'
              ? copy.route.editTemplateTitle
              : copy.route.createTemplateTitle
        }
        isOpen={templateModalState !== null}
        onClose={() => setTemplateModalState(null)}
        closeLabel={copy.common.close}
      >
        {templateModalState ? (
          <>
            {templateModalState.mode === 'duplicate' &&
            templateModalState.allowSourceSelection &&
            templates.length > 0 ? (
              <label>
                {copy.templateForm.selectDuplicateSource}
                <select
                  value={templateModalState.sourceTemplateId ?? ''}
                  onChange={(event) =>
                    setTemplateModalState((current) =>
                      current && current.mode === 'duplicate'
                        ? {
                            ...current,
                            sourceTemplateId: event.target.value || undefined,
                          }
                        : current,
                    )
                  }
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <TemplateEditor
              key={
                templateModalState.mode === 'edit'
                  ? templateModalState.templateId
                  : templateModalState.mode === 'duplicate'
                    ? templateModalState.sourceTemplateId ?? 'template_blank'
                    : 'template_blank'
              }
              language={language}
              mode={templateModalState.mode}
              initialName={templateEditorInitialName}
              initialStartDate={templateEditorInitialStartDate}
              initialDays={templateEditorInitialDays}
              exerciseSuggestions={templateExerciseSuggestions}
              exerciseHistory={exerciseHistory}
              onSubmit={handleSaveTemplate}
              onCancel={() => setTemplateModalState(null)}
            />
          </>
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
            exerciseHistory={exerciseHistory}
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
