import clsx from 'clsx'

import { getCopy, type AppLanguage } from '@/lib/i18n'

import styles from './styles/AppFooterControls.module.css'

type AppFooterControlsProps = {
  language: AppLanguage
  theme: 'light' | 'dark'
  onLanguageChange: (language: AppLanguage) => void
  onToggleTheme: () => void
}

export function AppFooterControls({
  language,
  theme,
  onLanguageChange,
  onToggleTheme,
}: AppFooterControlsProps) {
  const copy = getCopy(language)
  const isDark = theme === 'dark'
  const nextLanguage = language === 'en' ? 'sv' : 'en'
  const themeToggleLabel = isDark ? copy.appHeader.useLightMode : copy.appHeader.useDarkMode
  const languageToggleLabel = `${copy.appHeader.languageSwitcherAria}: ${
    nextLanguage === 'en' ? copy.appHeader.english : copy.appHeader.swedish
  }`

  return (
    <footer className={styles.wrapper}>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onToggleTheme}
          aria-pressed={isDark}
          aria-label={themeToggleLabel}
        >
          <span className={styles.iconTrack} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              className={clsx(styles.themeGlyph, styles.sunGlyph, isDark && styles.hiddenGlyph)}
            >
              <circle cx="12" cy="12" r="4.1" />
              <path d="M12 2.5v2.5M12 19v2.5M4.7 4.7l1.8 1.8M17.5 17.5l1.8 1.8M2.5 12H5M19 12h2.5M4.7 19.3l1.8-1.8M17.5 6.5l1.8-1.8" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className={clsx(styles.themeGlyph, styles.moonGlyph, !isDark && styles.hiddenGlyph)}
            >
              <path d="M20.4 14.2A8.5 8.5 0 1 1 9.8 3.6a7.2 7.2 0 1 0 10.6 10.6Z" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onLanguageChange(nextLanguage)}
          aria-pressed={language === 'sv'}
          aria-label={languageToggleLabel}
        >
          <span className={styles.langTrack} aria-hidden="true">
            <span
              className={clsx(
                styles.langGlyph,
                language === 'en' ? styles.langVisible : styles.langHiddenTop,
              )}
            >
              EN
            </span>
            <span
              className={clsx(
                styles.langGlyph,
                language === 'sv' ? styles.langVisible : styles.langHiddenBottom,
              )}
            >
              SE
            </span>
          </span>
        </button>
      </div>
    </footer>
  )
}
