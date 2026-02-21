import type { ExerciseTemplate, PlanDay, PlanTemplate } from './types'

export const STARTER_TEMPLATE_ID = 'starter_upper_lower_4d'

export type StarterTemplateBundle = {
  template: PlanTemplate
  planDays: PlanDay[]
  exercises: ExerciseTemplate[]
}

export function createStarterTemplateBundle(timestampIso: string): StarterTemplateBundle {
  const template: PlanTemplate = {
    id: STARTER_TEMPLATE_ID,
    name: '4-Day Upper/Lower Split',
    startDate: '1970-01-01',
    locale: 'en',
    isStarter: true,
    createdAt: timestampIso,
    updatedAt: timestampIso,
  }

  const planDays: PlanDay[] = [
    {
      id: `${STARTER_TEMPLATE_ID}_upper_a`,
      templateId: template.id,
      weekday: 1,
      label: 'Upper Body A (Push-dominant)',
    },
    {
      id: `${STARTER_TEMPLATE_ID}_lower_a`,
      templateId: template.id,
      weekday: 2,
      label: 'Lower Body A (Knee-dominant)',
    },
    {
      id: `${STARTER_TEMPLATE_ID}_upper_b`,
      templateId: template.id,
      weekday: 4,
      label: 'Upper Body B (Pull-dominant)',
    },
    {
      id: `${STARTER_TEMPLATE_ID}_lower_b`,
      templateId: template.id,
      weekday: 5,
      label: 'Lower Body B (Hip-dominant)',
    },
  ]

  const exercises: ExerciseTemplate[] = [
    { id: 'ex_bench_press', planDayId: planDays[0]!.id, name: 'Bench Press', sets: 4, minReps: 5, maxReps: 8, restSecDefault: 120 },
    { id: 'ex_pullups', planDayId: planDays[0]!.id, name: 'Pull-ups / Lat Pulldown', sets: 4, minReps: 6, maxReps: 10, restSecDefault: 120 },
    { id: 'ex_overhead_press', planDayId: planDays[0]!.id, name: 'Shoulder Press', sets: 3, minReps: 6, maxReps: 10, restSecDefault: 90 },
    { id: 'ex_incline_db_press', planDayId: planDays[0]!.id, name: 'Incline Dumbbell Press', sets: 3, minReps: 8, maxReps: 12, restSecDefault: 90 },
    { id: 'ex_biceps_curl', planDayId: planDays[0]!.id, name: 'Biceps Curls', sets: 3, minReps: 10, maxReps: 12, restSecDefault: 75 },
    { id: 'ex_triceps_pushdown', planDayId: planDays[0]!.id, name: 'Triceps Pushdown', sets: 3, minReps: 10, maxReps: 12, restSecDefault: 75 },

    { id: 'ex_back_squat', planDayId: planDays[1]!.id, name: 'Back Squat', sets: 4, minReps: 5, maxReps: 8, restSecDefault: 150 },
    { id: 'ex_rdl', planDayId: planDays[1]!.id, name: 'Romanian Deadlift', sets: 3, minReps: 6, maxReps: 10, restSecDefault: 120 },
    { id: 'ex_lunges', planDayId: planDays[1]!.id, name: 'Lunges', sets: 3, minReps: 8, maxReps: 12, restSecDefault: 90 },
    { id: 'ex_leg_curl', planDayId: planDays[1]!.id, name: 'Leg Curl', sets: 3, minReps: 10, maxReps: 15, restSecDefault: 90 },
    { id: 'ex_calf_raise', planDayId: planDays[1]!.id, name: 'Calf Raise', sets: 4, minReps: 12, maxReps: 15, restSecDefault: 60 },

    { id: 'ex_barbell_row', planDayId: planDays[2]!.id, name: 'Barbell Row', sets: 4, minReps: 6, maxReps: 10, restSecDefault: 120 },
    { id: 'ex_incline_bench', planDayId: planDays[2]!.id, name: 'Incline Bench Press', sets: 4, minReps: 6, maxReps: 10, restSecDefault: 120 },
    { id: 'ex_lateral_raise', planDayId: planDays[2]!.id, name: 'Lateral Raises', sets: 3, minReps: 12, maxReps: 15, restSecDefault: 75 },
    { id: 'ex_cable_row', planDayId: planDays[2]!.id, name: 'Cable Row', sets: 3, minReps: 8, maxReps: 12, restSecDefault: 90 },
    { id: 'ex_hammer_curl', planDayId: planDays[2]!.id, name: 'Hammer Curls', sets: 3, minReps: 10, maxReps: 12, restSecDefault: 75 },
    { id: 'ex_skull_crusher', planDayId: planDays[2]!.id, name: 'Skull Crushers', sets: 3, minReps: 10, maxReps: 12, restSecDefault: 75 },

    { id: 'ex_deadlift', planDayId: planDays[3]!.id, name: 'Deadlift', sets: 3, minReps: 4, maxReps: 6, restSecDefault: 150 },
    { id: 'ex_front_squat', planDayId: planDays[3]!.id, name: 'Front Squat / Leg Press', sets: 3, minReps: 6, maxReps: 10, restSecDefault: 120 },
    { id: 'ex_hip_thrust', planDayId: planDays[3]!.id, name: 'Hip Thrust', sets: 3, minReps: 8, maxReps: 12, restSecDefault: 90 },
    { id: 'ex_leg_extension', planDayId: planDays[3]!.id, name: 'Leg Extension', sets: 3, minReps: 12, maxReps: 15, restSecDefault: 75 },
    { id: 'ex_seated_calf_raise', planDayId: planDays[3]!.id, name: 'Seated Calf Raise', sets: 4, minReps: 12, maxReps: 15, restSecDefault: 60 },
  ]

  return { template, planDays, exercises }
}
