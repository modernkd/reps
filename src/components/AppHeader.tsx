import clsx from 'clsx'

import { getCopy } from '@/lib/i18n'
import type { AppLanguage } from '@/lib/i18n'

import styles from './styles/AppHeader.module.css'

type AppHeaderProps = {
  view: 'calendar' | 'graph'
  language: AppLanguage
  onViewChange: (view: 'calendar' | 'graph') => void
  onOpenCreateWorkout: () => void
  onImportTemplate: () => Promise<void>
  importingTemplate: boolean
}

export function AppHeader({
  view,
  language,
  onViewChange,
  onOpenCreateWorkout,
  onImportTemplate,
  importingTemplate,
}: AppHeaderProps) {
  const copy = getCopy(language)

  return (
    <header className={styles.wrapper}>
      <div>
        <p className={styles.kicker}>{copy.appHeader.kicker}</p>
        <h1>{copy.appHeader.title}</h1>
      </div>

      <div className={styles.controls}>
        <div
          className={styles.toggle}
          role="tablist"
          aria-label={copy.appHeader.viewSwitcherAria}
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'calendar'}
            className={clsx(view === 'calendar' && styles.active)}
            onClick={() => onViewChange('calendar')}
          >
            {copy.appHeader.calendar}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'graph'}
            className={clsx(view === 'graph' && styles.active)}
            onClick={() => onViewChange('graph')}
          >
            {copy.appHeader.graphs}
          </button>
        </div>

        <button type="button" className={styles.secondary} onClick={onImportTemplate}>
          {importingTemplate
            ? copy.appHeader.importingTemplate
            : copy.appHeader.importTemplate}
        </button>

        <button type="button" className={styles.primary} onClick={onOpenCreateWorkout}>
          {copy.appHeader.addWorkout}
        </button>
      </div>
    </header>
  )
}
