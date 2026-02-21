import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppFooterControls } from './AppFooterControls'

function renderFooter(theme: 'light' | 'dark' = 'light', language: 'en' | 'sv' = 'en') {
  const props = {
    language,
    theme,
    onLanguageChange: vi.fn(),
    onToggleTheme: vi.fn(),
  }

  render(<AppFooterControls {...props} />)
  return props
}

describe('AppFooterControls', () => {
  it('toggles theme from the icon button', () => {
    const props = renderFooter('light', 'en')

    const button = screen.getByRole('button', { name: 'Use dark mode' })
    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1)
  })

  it('switches language from English to Swedish', () => {
    const props = renderFooter('light', 'en')

    fireEvent.click(screen.getByRole('button', { name: 'Language switcher: Svenska' }))

    expect(props.onLanguageChange).toHaveBeenCalledWith('sv')
  })

  it('shows dark mode state and offers switching to light mode', () => {
    renderFooter('dark', 'en')

    const button = screen.getByRole('button', { name: 'Use light mode' })

    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})
