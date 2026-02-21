import clsx from 'clsx'

import { getCopy } from '@/lib/i18n'
import type { AppLanguage } from '@/lib/i18n'

import styles from './styles/AppHeader.module.css'

type AppHeaderProps = {
  view: 'calendar' | 'graph'
  language: AppLanguage
  templates: Array<{ id: string; name: string }>
  activeTemplateId?: string
  onViewChange: (view: 'calendar' | 'graph') => void
  onTemplateChange: (templateId: string) => void
  onOpenCreateTemplate: () => void
  onOpenDuplicateTemplate: () => void
  onOpenCreateWorkout: () => void
}

const DUPLICATE_TEMPLATE_ACTION = '__duplicate_template__'

export function AppHeader({
  view,
  language,
  templates,
  activeTemplateId,
  onViewChange,
  onTemplateChange,
  onOpenCreateTemplate,
  onOpenDuplicateTemplate,
  onOpenCreateWorkout,
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

        <label className={styles.templatePicker}>
          <span>{copy.appHeader.templateLabel}</span>
          <select
            aria-label={copy.appHeader.selectTemplate}
            value={activeTemplateId ?? ''}
            onChange={(event) => {
              if (event.target.value === DUPLICATE_TEMPLATE_ACTION) {
                onOpenDuplicateTemplate()
                return
              }

              onTemplateChange(event.target.value)
            }}
          >
            {templates.length === 0 ? (
              <option value="">{copy.appHeader.selectTemplate}</option>
            ) : null}
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
            <option value={DUPLICATE_TEMPLATE_ACTION} disabled={templates.length === 0}>
              {copy.appHeader.duplicateTemplate}
            </option>
          </select>
        </label>

        <button
          type="button"
          className={styles.secondary}
          onClick={onOpenCreateTemplate}
        >
          {copy.appHeader.addTemplateToCalendar}
        </button>

        <button type="button" className={styles.primary} onClick={onOpenCreateWorkout}>
          {copy.appHeader.addWorkout}
        </button>
      </div>
    </header>
  )
}
