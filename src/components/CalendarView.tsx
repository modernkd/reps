import clsx from "clsx";
import { format, parseISO } from "date-fns";

import { todayIso } from "@/lib/date";
import type { AppLanguage } from "@/lib/i18n";
import { getCopy, getDateLocale } from "@/lib/i18n";
import type { CalendarDayModel } from "@/lib/types";

import styles from "./styles/CalendarView.module.css";

type CalendarViewProps = {
  language: AppLanguage;
  month: string;
  model: CalendarDayModel[];
  selectedDate: string;
  onDaySelect: (date: string) => void;
  onMonthChange: (offset: number) => void;
};

export function CalendarView({
  language,
  month,
  model,
  selectedDate,
  onDaySelect,
  onMonthChange,
}: CalendarViewProps) {
  const copy = getCopy(language);
  const dateLocale = getDateLocale(language);
  const monthDate = parseISO(`${month}-01`);
  const today = todayIso();

  const indexByDate = new Map(model.map((day, index) => [day.date, index]));

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = indexByDate.get(selectedDate);
    if (currentIndex === undefined) {
      return;
    }

    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = Math.min(model.length - 1, currentIndex + 1);
    }
    if (event.key === "ArrowLeft") {
      nextIndex = Math.max(0, currentIndex - 1);
    }
    if (event.key === "ArrowDown") {
      nextIndex = Math.min(model.length - 1, currentIndex + 7);
    }
    if (event.key === "ArrowUp") {
      nextIndex = Math.max(0, currentIndex - 7);
    }

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      onDaySelect(model[nextIndex]!.date);
    }
  };

  return (
    <section className={styles.wrapper} aria-label={copy.calendar.sectionAria}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.monthButton}
          aria-label={copy.calendar.previous}
          onClick={() => onMonthChange(-1)}
        >
          {copy.calendar.previous}
        </button>
        <h2>{format(monthDate, "MMMM yyyy", { locale: dateLocale })}</h2>
        <button
          type="button"
          className={styles.monthButton}
          aria-label={copy.calendar.next}
          onClick={() => onMonthChange(1)}
        >
          {copy.calendar.next}
        </button>
      </header>

      <div className={styles.weekdays}>
        {copy.calendar.weekdayLabels.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div
        className={styles.grid}
        role="grid"
        aria-label={copy.calendar.gridAria}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
      >
        {model.map((day) => {
          const count = day.workouts.length;
          const plannedCount = day.sessions.filter(
            (item) => item.status !== "completed",
          ).length;
          const isSelected = selectedDate === day.date;
          const isPastDay = day.date <= today;
          const isCompleted =
            count > 0 ||
            day.sessions.some((session) => session.status === "completed");
          const isSkipped = day.sessions.some(
            (session) => session.status === "skipped",
          );
          const pastStatusClass = isPastDay
            ? isCompleted
              ? styles.pastCompleted
              : isSkipped
                ? styles.pastSkipped
                : null
            : null;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onDaySelect(day.date)}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={copy.calendar.dayAria(day.date, count, plannedCount)}
              className={clsx(
                styles.day,
                !day.inCurrentMonth && styles.outOfMonth,
                pastStatusClass
                  ? pastStatusClass
                  : count > 0 && styles.hasWorkout,

                isSelected && styles.selected,
              )}
            >
              <span className={styles.dayNumber}>
                {format(parseISO(day.date), "d", { locale: dateLocale })}
              </span>
              <span className={styles.metrics}>
                {count > 0 ? (
                  <em>
                    <span className={styles.metricValue}>{count}</span>
                    <span className={styles.metricLabel}>
                      {copy.calendar.done}
                    </span>
                  </em>
                ) : null}
                {plannedCount > 0 ? (
                  <em>
                    <span className={styles.metricValue}>{plannedCount}</span>
                    <span className={styles.metricLabel}>
                      {copy.calendar.planned}
                    </span>
                  </em>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
