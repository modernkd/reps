import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { addDaysIso, todayIso } from '@/lib/date'

import { CalendarView } from './CalendarView'
import styles from './styles/CalendarView.module.css'

function createWorkout(date: string) {
  return {
    id: `workout-${date}`,
    date,
    type: 'lift',
    durationMin: 45,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
  }
}

function createSession(date: string, status: 'planned' | 'in_progress' | 'completed' | 'skipped') {
  return {
    id: `session-${date}-${status}`,
    templateId: 'template-1',
    planDayId: 'plan-day-1',
    date,
    status,
  }
}

describe('CalendarView', () => {
  it('applies completed and skipped colors only on past days', () => {
    const today = todayIso()
    const pastCompletedDate = addDaysIso(today, -2)
    const pastSkippedDate = addDaysIso(today, -1)
    const futureSkippedDate = addDaysIso(today, 1)

    render(
      <CalendarView
        language="en"
        month={today.slice(0, 7)}
        selectedDate={today}
        onDaySelect={vi.fn()}
        onMonthChange={vi.fn()}
        model={[
          {
            date: pastCompletedDate,
            inCurrentMonth: true,
            workouts: [createWorkout(pastCompletedDate)],
            sessions: [],
          },
          {
            date: pastSkippedDate,
            inCurrentMonth: true,
            workouts: [],
            sessions: [createSession(pastSkippedDate, 'skipped')],
          },
          {
            date: futureSkippedDate,
            inCurrentMonth: true,
            workouts: [],
            sessions: [createSession(futureSkippedDate, 'skipped')],
          },
        ]}
      />,
    )

    const dayCells = screen.getAllByRole('gridcell')
    expect(dayCells[0]).toHaveClass(styles.pastCompleted)
    expect(dayCells[1]).toHaveClass(styles.pastSkipped)
    expect(dayCells[2]).not.toHaveClass(styles.pastSkipped)
    expect(dayCells[2]).not.toHaveClass(styles.pastCompleted)
  })
})
