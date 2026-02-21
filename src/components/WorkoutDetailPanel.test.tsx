import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkoutDetailPanel } from './WorkoutDetailPanel'

function createProps() {
  return {
    language: 'en' as const,
    date: '2026-02-10',
    workouts: [],
    scheduledSessions: [],
    planDays: [],
    workoutTypes: [],
    onCreate: vi.fn(),
    onPasteWorkout: vi.fn(),
    canPasteWorkout: false,
    canClearAfter: true,
    onClearAfter: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCopyWorkout: vi.fn(),
    onCopyToNextWeek: vi.fn(),
    onStartWorkout: vi.fn(),
    onSkipSession: vi.fn(),
    onPreviewSession: vi.fn(),
    onResetSession: vi.fn(),
  }
}

describe('WorkoutDetailPanel', () => {
  it('requests clear-after with the selected date', () => {
    const props = createProps()
    render(<WorkoutDetailPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear after' }))

    expect(props.onClearAfter).toHaveBeenCalledWith('2026-02-10')
  })

  it('disables clear-after button when no future records exist', () => {
    const props = createProps()
    props.canClearAfter = false
    render(<WorkoutDetailPanel {...props} />)

    expect(screen.getByRole('button', { name: 'Clear after' })).toBeDisabled()
  })

  it('shows estimated calories for completed workouts', () => {
    const props = createProps()
    props.workoutTypes = [{ id: 'lift', name: 'Lift', color: '#ef476f' }]
    props.workouts = [
      {
        id: 'workout-1',
        date: '2026-02-10',
        type: 'lift',
        durationMin: 45,
        intensity: 'medium',
        createdAt: '2026-02-10T08:00:00.000Z',
        updatedAt: '2026-02-10T08:00:00.000Z',
        sessionSummary: {
          startedAt: '2026-02-10T08:00:00.000Z',
          endedAt: '2026-02-10T08:45:00.000Z',
          totalDurationMin: 45,
          setLogs: Array.from({ length: 10 }, (_, index) => ({
            exerciseId: `e-${index}`,
            setIndex: index,
            restSecUsed: 75,
          })),
        },
      },
    ]

    render(<WorkoutDetailPanel {...props} />)

    expect(screen.getByText(/est\. 310 kcal/)).toBeVisible()
  })
})
