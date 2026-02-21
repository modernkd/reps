import clsx from 'clsx'
import { format, parseISO } from 'date-fns'

import type { CalendarDayModel } from '@/lib/types'

import styles from './styles/CalendarView.module.css'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type CalendarViewProps = {
  month: string
  model: CalendarDayModel[]
  selectedDate: string
  onDaySelect: (date: string) => void
  onMonthChange: (offset: number) => void
}

export function CalendarView({
  month,
  model,
  selectedDate,
  onDaySelect,
  onMonthChange,
}: CalendarViewProps) {
  const monthDate = parseISO(`${month}-01`)

  const indexByDate = new Map(model.map((day, index) => [day.date, index]))

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = indexByDate.get(selectedDate)
    if (currentIndex === undefined) {
      return
    }

    let nextIndex = currentIndex

    if (event.key === 'ArrowRight') {
      nextIndex = Math.min(model.length - 1, currentIndex + 1)
    }
    if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, currentIndex - 1)
    }
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(model.length - 1, currentIndex + 7)
    }
    if (event.key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - 7)
    }

    if (nextIndex !== currentIndex) {
      event.preventDefault()
      onDaySelect(model[nextIndex]!.date)
    }
  }

  return (
    <section className={styles.wrapper} aria-label="Workout calendar">
      <header className={styles.header}>
        <button type="button" onClick={() => onMonthChange(-1)}>
          Previous
        </button>
        <h2>{format(monthDate, 'MMMM yyyy')}</h2>
        <button type="button" onClick={() => onMonthChange(1)}>
          Next
        </button>
      </header>

      <div className={styles.weekdays}>
        {WEEKDAY_LABELS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div
        className={styles.grid}
        role="grid"
        aria-label="Monthly workout calendar"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
      >
        {model.map((day) => {
          const count = day.workouts.length
          const plannedCount = day.sessions.filter((item) => item.status !== 'completed').length
          const isSelected = selectedDate === day.date

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onDaySelect(day.date)}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${day.date}, ${count} workouts, ${plannedCount} planned sessions`}
              className={clsx(
                styles.day,
                !day.inCurrentMonth && styles.outOfMonth,
                isSelected && styles.selected,
                count > 0 && styles.hasWorkout,
              )}
            >
              <span className={styles.dayNumber}>{format(parseISO(day.date), 'd')}</span>
              <span className={styles.metrics}>
                {count > 0 ? <em>{count} done</em> : null}
                {plannedCount > 0 ? <em>{plannedCount} planned</em> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
