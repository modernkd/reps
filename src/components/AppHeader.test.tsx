import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppHeader } from './AppHeader'

function renderHeader() {
  const props = {
    view: 'calendar' as const,
    language: 'en' as const,
    onViewChange: vi.fn(),
    onOpenCreateWorkout: vi.fn(),
    onImportTemplate: vi.fn().mockResolvedValue(undefined),
    importingTemplate: false,
  }

  render(<AppHeader {...props} />)
  return props
}

describe('AppHeader', () => {
  it('requests graph view when selecting Graphs', () => {
    const props = renderHeader()

    fireEvent.click(screen.getByRole('tab', { name: 'Graphs' }))

    expect(props.onViewChange).toHaveBeenCalledWith('graph')
  })

  it('requests workout import when template button is clicked', () => {
    const props = renderHeader()

    const button = screen.getByRole('button', { name: 'Import 4-day template' })
    fireEvent.click(button)

    expect(props.onImportTemplate).toHaveBeenCalledTimes(1)
  })

  it('requests add workout when primary action is clicked', () => {
    const props = renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Add workout' }))

    expect(props.onOpenCreateWorkout).toHaveBeenCalledTimes(1)
  })
})
