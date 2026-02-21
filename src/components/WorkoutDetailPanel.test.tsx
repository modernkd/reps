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
})
