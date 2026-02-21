import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppHeader } from './AppHeader'

function renderHeader() {
  const props = {
    view: 'calendar' as const,
    language: 'en' as const,
    templates: [{ id: 'template-1', name: 'Template 1' }],
    activeTemplateId: 'template-1',
    onViewChange: vi.fn(),
    onTemplateChange: vi.fn(),
    onOpenCreateTemplate: vi.fn(),
    onOpenDuplicateTemplate: vi.fn(),
    onOpenCreateWorkout: vi.fn(),
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

  it('opens create-template flow from template dropdown action', () => {
    const props = renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Add template to calendar' }))

    expect(props.onOpenCreateTemplate).toHaveBeenCalledTimes(1)
  })

  it('opens duplicate-template flow from template dropdown action', () => {
    const props = renderHeader()

    fireEvent.change(screen.getByRole('combobox', { name: 'Select template' }), {
      target: { value: '__duplicate_template__' },
    })

    expect(props.onOpenDuplicateTemplate).toHaveBeenCalledTimes(1)
  })

  it('requests template change when selecting a template id', () => {
    const props = renderHeader()

    fireEvent.change(screen.getByRole('combobox', { name: 'Select template' }), {
      target: { value: 'template-1' },
    })

    expect(props.onTemplateChange).toHaveBeenCalledWith('template-1')
  })

  it('requests add workout when primary action is clicked', () => {
    const props = renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Add workout' }))

    expect(props.onOpenCreateWorkout).toHaveBeenCalledTimes(1)
  })
})
