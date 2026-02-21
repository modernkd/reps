import clsx from 'clsx'

import styles from './styles/AppHeader.module.css'

type AppHeaderProps = {
  view: 'calendar' | 'graph'
  onViewChange: (view: 'calendar' | 'graph') => void
  onOpenCreateWorkout: () => void
  onImportTemplate: () => Promise<void>
  importingTemplate: boolean
}

export function AppHeader({
  view,
  onViewChange,
  onOpenCreateWorkout,
  onImportTemplate,
  importingTemplate,
}: AppHeaderProps) {
  return (
    <header className={styles.wrapper}>
      <div>
        <p className={styles.kicker}>Workout Tracker</p>
        <h1>Consistency dashboard</h1>
      </div>

      <div className={styles.controls}>
        <div className={styles.toggle} role="tablist" aria-label="View switcher">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'calendar'}
            className={clsx(view === 'calendar' && styles.active)}
            onClick={() => onViewChange('calendar')}
          >
            Calendar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'graph'}
            className={clsx(view === 'graph' && styles.active)}
            onClick={() => onViewChange('graph')}
          >
            Graphs
          </button>
        </div>

        <button type="button" className={styles.secondary} onClick={onImportTemplate}>
          {importingTemplate ? 'Importing...' : 'Import 4-day template'}
        </button>

        <button type="button" className={styles.primary} onClick={onOpenCreateWorkout}>
          Add workout
        </button>
      </div>
    </header>
  )
}
