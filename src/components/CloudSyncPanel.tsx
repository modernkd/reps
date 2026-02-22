import { useState } from 'react'

import styles from './styles/CloudSyncPanel.module.css'

type CloudSyncPanelCopy = {
  title: string
  setupHint: string
  signedOutHint: string
  emailLabel: string
  passwordLabel: string
  signIn: string
  signUp: string
  signOut: string
  syncNow: string
  syncing: string
  connectedAs: (email: string) => string
  lastSynced: (value: string) => string
}

type CloudSyncPanelProps = {
  copy: CloudSyncPanelCopy
  isConfigured: boolean
  userEmail?: string
  isAuthBusy: boolean
  isSyncBusy: boolean
  statusMessage?: string | null
  errorMessage?: string | null
  lastSyncedLabel?: string | null
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onSignOut: () => Promise<void>
  onSyncNow: () => Promise<void>
}

export function CloudSyncPanel({
  copy,
  isConfigured,
  userEmail,
  isAuthBusy,
  isSyncBusy,
  statusMessage,
  errorMessage,
  lastSyncedLabel,
  onSignIn,
  onSignUp,
  onSignOut,
  onSyncNow,
}: CloudSyncPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const hasUser = Boolean(userEmail)
  const isBusy = isAuthBusy || isSyncBusy

  const handleAuthSubmit = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password.trim()) {
      return
    }

    if (mode === 'signUp') {
      await onSignUp(normalizedEmail, password)
      return
    }

    await onSignIn(normalizedEmail, password)
  }

  return (
    <section className={styles.panel} aria-live="polite">
      <div className={styles.header}>
        <h2>{copy.title}</h2>
        {!isConfigured ? <p>{copy.setupHint}</p> : null}
      </div>

      {isConfigured && !hasUser ? (
        <div className={styles.form}>
          <p className={styles.hint}>{copy.signedOutHint}</p>
          <label>
            {copy.emailLabel}
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            {copy.passwordLabel}
            <input
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={mode === 'signIn' ? styles.activeMode : undefined}
              onClick={() => setMode('signIn')}
              disabled={isBusy}
            >
              {copy.signIn}
            </button>
            <button
              type="button"
              className={mode === 'signUp' ? styles.activeMode : undefined}
              onClick={() => setMode('signUp')}
              disabled={isBusy}
            >
              {copy.signUp}
            </button>
            <button type="button" onClick={handleAuthSubmit} disabled={isBusy}>
              {isBusy ? copy.syncing : mode === 'signUp' ? copy.signUp : copy.signIn}
            </button>
          </div>
        </div>
      ) : null}

      {isConfigured && hasUser ? (
        <div className={styles.connected}>
          <p>{copy.connectedAs(userEmail!)}</p>
          {lastSyncedLabel ? <p>{copy.lastSynced(lastSyncedLabel)}</p> : null}
          <div className={styles.actions}>
            <button type="button" onClick={onSyncNow} disabled={isBusy}>
              {isSyncBusy ? copy.syncing : copy.syncNow}
            </button>
            <button type="button" onClick={onSignOut} disabled={isBusy}>
              {copy.signOut}
            </button>
          </div>
        </div>
      ) : null}

      {statusMessage ? <p className={styles.status}>{statusMessage}</p> : null}
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </section>
  )
}
