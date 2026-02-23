import { z } from "zod";

export const intensitySchema = z.enum(["low", "medium", "high"]);
export type WorkoutIntensity = z.infer<typeof intensitySchema>;

export const setLogSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string().optional(),
  setIndex: z.number().int().nonnegative(),
  targetReps: z.number().int().positive().optional(),
  actualReps: z.number().int().nonnegative().optional(),
  weightKg: z.number().nonnegative().optional(),
  restSecUsed: z.number().int().nonnegative(),
});
export type SetLog = z.infer<typeof setLogSchema>;

export const sessionSummarySchema = z.object({
  startedAt: z.string(),
  endedAt: z.string(),
  totalDurationMin: z.number().nonnegative(),
  setLogs: z.array(setLogSchema),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const workoutSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: z.string(),
  durationMin: z.number().int().positive(),
  targetWeightKg: z.number().positive().optional(),
  distanceKm: z.number().positive().optional(),
  intensity: intensitySchema.optional(),
  notes: z.string().max(1000).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  scheduledSessionId: z.string().optional(),
  sessionSummary: sessionSummarySchema.optional(),
});
export type Workout = z.infer<typeof workoutSchema>;

export const workoutTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});
export type WorkoutType = z.infer<typeof workoutTypeSchema>;

export const planTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  locale: z.string(),
  isStarter: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlanTemplate = z.infer<typeof planTemplateSchema>;

export const planDaySchema = z.object({
  id: z.string(),
  templateId: z.string(),
  weekday: z.number().int().min(1).max(7),
  label: z.string(),
});
export type PlanDay = z.infer<typeof planDaySchema>;

export const exerciseTemplateSchema = z.object({
  id: z.string(),
  planDayId: z.string(),
  name: z.string(),
  sets: z.number().int().positive(),
  minReps: z.number().int().positive().optional(),
  maxReps: z.number().int().positive().optional(),
  restSecDefault: z.number().int().positive().optional(),
  targetMassKg: z.number().positive().optional(),
});
export type ExerciseTemplate = z.infer<typeof exerciseTemplateSchema>;

export const exerciseCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExerciseCatalogEntry = z.infer<typeof exerciseCatalogEntrySchema>;

export const scheduledSessionStatusSchema = z.enum([
  "planned",
  "in_progress",
  "completed",
  "skipped",
]);
export type ScheduledSessionStatus = z.infer<
  typeof scheduledSessionStatusSchema
>;

export const plannedWorkoutSchema = z.object({
  type: z.string(),
  durationMin: z.number().int().positive(),
  targetWeightKg: z.number().positive().optional(),
  distanceKm: z.number().positive().optional(),
  intensity: intensitySchema.optional(),
  notes: z.string().max(1000).optional(),
});
export type PlannedWorkout = z.infer<typeof plannedWorkoutSchema>;

export const scheduledSessionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  planDayId: z.string(),
  date: z.string(),
  status: scheduledSessionStatusSchema,
  workoutId: z.string().optional(),
  plannedWorkout: plannedWorkoutSchema.optional(),
});
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>;

export const activeSessionDraftSchema = z.object({
  sessionId: z.string(),
  startedAt: z.string(),
  currentExerciseIndex: z.number().int().nonnegative(),
  currentSetIndex: z.number().int().nonnegative(),
  setLogs: z.array(setLogSchema),
  restEndAt: z.string().optional(),
  timerPaused: z.boolean(),
  timerRemainingSec: z.number().int().nonnegative().optional(),
  updatedAt: z.string(),
});
export type ActiveSessionDraft = z.infer<typeof activeSessionDraftSchema>;

export const sessionExercisePlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.number().int().positive(),
  minReps: z.number().int().positive().optional(),
  maxReps: z.number().int().positive().optional(),
  restSecDefault: z.number().int().positive().optional(),
  targetMassKg: z.number().positive().optional(),
});
export type SessionExercisePlan = z.infer<typeof sessionExercisePlanSchema>;

export const sessionPlanSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  exercises: z.array(sessionExercisePlanSchema),
  updatedAt: z.string(),
});
export type SessionPlan = z.infer<typeof sessionPlanSchema>;

export type CalendarDayModel = {
  date: string;
  inCurrentMonth: boolean;
  workouts: Workout[];
  sessions: ScheduledSession[];
};

export type WeeklyTrendPoint = {
  weekStart: string;
  workoutsPerWeek: number;
  totalDurationPerWeek: number;
  avgWeightKg: number | null;
};

export type WeeklyTrendSeries = {
  points: WeeklyTrendPoint[];
};

export type ProgressPoint = {
  date: string;
  value: number;
};
