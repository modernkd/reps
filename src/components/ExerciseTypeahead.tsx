import { useEffect, useId, useMemo, useRef, useState } from 'react'

import styles from './styles/ExerciseTypeahead.module.css'

const MAX_VISIBLE_SUGGESTIONS = 8

type ExerciseTypeaheadProps = {
  id: string
  label: string
  placeholder: string
  value: string
  suggestions: string[]
  onChange: (nextValue: string) => void
  searchMode?: 'simple' | 'enhanced'
  onEnhancedSearch?: (query: string) => string[]
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

export function ExerciseTypeahead({
  id,
  label,
  placeholder,
  value,
  suggestions,
  onChange,
  searchMode = 'simple',
  onEnhancedSearch,
}: ExerciseTypeaheadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [enhancedResults, setEnhancedResults] = useState<string[]>([])
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()
  const normalizedValue = normalizeQuery(value)

  // Debounced enhanced search
  useEffect(() => {
    if (searchMode !== 'enhanced' || !onEnhancedSearch || !normalizedValue) {
      setEnhancedResults([])
      return
    }

    const timeoutId = setTimeout(() => {
      const results = onEnhancedSearch(value)
      setEnhancedResults(results)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [value, searchMode, onEnhancedSearch, normalizedValue])

  const filteredSuggestions = useMemo(() => {
    const unique = new Set<string>()
    const next: string[] = []

    // Use enhanced results if available, otherwise fall back to simple filtering
    const sourceSuggestions = searchMode === 'enhanced' && enhancedResults.length > 0
      ? enhancedResults
      : suggestions

    for (const suggestion of sourceSuggestions) {
      const trimmed = suggestion.trim()
      if (!trimmed) {
        continue
      }

      const normalizedSuggestion = normalizeQuery(trimmed)

      // In simple mode, filter by substring. In enhanced mode, trust the results
      if (searchMode === 'simple' && normalizedValue && !normalizedSuggestion.includes(normalizedValue)) {
        continue
      }

      if (!unique.has(normalizedSuggestion)) {
        unique.add(normalizedSuggestion)
        next.push(trimmed)
      }

      if (next.length >= MAX_VISIBLE_SUGGESTIONS) {
        break
      }
    }

    return next
  }, [normalizedValue, suggestions, enhancedResults, searchMode])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return
      }

      setIsOpen(false)
      setActiveIndex(-1)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!filteredSuggestions.length) {
      setActiveIndex(-1)
      return
    }

    setActiveIndex((current) =>
      current < filteredSuggestions.length ? current : filteredSuggestions.length - 1,
    )
  }, [filteredSuggestions])

  const isListVisible = isOpen && filteredSuggestions.length > 0
  const activeOptionId =
    activeIndex >= 0 && activeIndex < filteredSuggestions.length
      ? `${listboxId}-option-${activeIndex}`
      : undefined

  return (
    <div className={styles.root} ref={rootRef}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            onChange(event.currentTarget.value)
            setIsOpen(true)
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isListVisible}
          aria-controls={isListVisible ? listboxId : undefined}
          aria-activedescendant={isListVisible ? activeOptionId : undefined}
          onKeyDown={(event) => {
            if (!isListVisible) {
              return
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((current) => {
                if (current < 0) {
                  return 0
                }
                return (current + 1) % filteredSuggestions.length
              })
              return
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((current) => {
                if (current <= 0) {
                  return filteredSuggestions.length - 1
                }
                return current - 1
              })
              return
            }

            if (event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault()
              const selectedSuggestion = filteredSuggestions[activeIndex]
              if (selectedSuggestion) {
                onChange(selectedSuggestion)
                setIsOpen(false)
                setActiveIndex(-1)
              }
              return
            }

            if (event.key === 'Escape') {
              setIsOpen(false)
              setActiveIndex(-1)
            }
          }}
        />
        {isListVisible ? (
          <ul id={listboxId} className={styles.listbox} role="listbox">
            {filteredSuggestions.map((suggestion, index) => {
              const optionId = `${listboxId}-option-${index}`
              const isActive = index === activeIndex

              return (
                <li
                  key={suggestion}
                  id={optionId}
                  role="option"
                  aria-selected={isActive}
                  className={isActive ? `${styles.option} ${styles.optionActive}` : styles.option}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      onChange(suggestion)
                      setIsOpen(false)
                      setActiveIndex(-1)
                    }}
                  >
                    {suggestion}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
