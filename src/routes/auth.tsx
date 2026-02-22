import { Link, createFileRoute } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import {
  getCurrentCloudUser,
  isCloudSyncConfigured,
  signInCloudUser,
  signInCloudUserWithGoogle,
  signOutCloudUser,
  signUpCloudUser,
  subscribeToCloudAuthState,
  updateCloudUserName,
} from '@/lib/cloudSync'
import { getCopy, type AppLanguage } from '@/lib/i18n'

import styles from './auth.module.css'

const languageStorageKey = 'workout-tracker-language'

function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'en'
  }

  try {
    const storedLanguage = window.localStorage.getItem(languageStorageKey)
    if (storedLanguage === 'en' || storedLanguage === 'sv') {
      return storedLanguage
    }
  } catch {
    // Keep default language.
  }

  return 'en'
}

function getCloudDisplayName(user: User | null): string {
  if (!user) {
    return ''
  }

  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : typeof user.user_metadata?.display_name === 'string'
          ? user.user_metadata.display_name
          : ''

  if (metadataName.trim()) {
    return metadataName.trim()
  }

  const email = user.email?.trim()
  if (!email) {
    return ''
  }

  const emailName = email.split('@')[0] || ''
  return emailName.trim()
}

export const Route = createFileRoute('/auth')({
  validateSearch: (search) =>
    z
      .object({
        redirect: z.string().optional(),
        flow: z.enum(['oauth']).optional(),
      })
      .parse(search),
  component: AuthRoute,
})

function normalizeRedirectPath(redirect?: string): string {
  if (!redirect) {
    return '/'
  }

  if (!redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/'
  }

  return redirect
}

function AuthRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [language] = useState<AppLanguage>(() => getPreferredLanguage())
  const copy = getCopy(language)
  const cloudSyncEnabled = isCloudSyncConfigured()
  const redirectPath = useMemo(
    () => normalizeRedirectPath(search.redirect),
    [search.redirect],
  )

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cloudSyncEnabled) {
      return
    }

    let isMounted = true

    getCurrentCloudUser()
      .then((currentUser) => {
        if (!isMounted) {
          return
        }

        setUser(currentUser)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }
        setError(copy.route.cloudAuthInitError)
      })

    const unsubscribe = subscribeToCloudAuthState((nextUser) => {
      if (!isMounted) {
        return
      }

      setUser(nextUser)
      if (!nextUser) {
        setStatus(copy.route.cloudSignedOut)
      }
    })

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [cloudSyncEnabled, copy.route.cloudAuthInitError, copy.route.cloudSignedOut])

  useEffect(() => {
    if (!user || search.flow !== 'oauth') {
      return
    }

    navigate({ to: redirectPath })
  }, [navigate, redirectPath, search.flow, user])

  useEffect(() => {
    if (!user) {
      return
    }

    setName(getCloudDisplayName(user))
  }, [user])

  const userEmail = user?.email?.trim()
  const hasUser = Boolean(user)
  const normalizedName = useMemo(() => name.trim(), [name])

  const handleEmailAuth = async () => {
    const normalizedEmail = email.trim()
    const normalizedPassword = password.trim()

    if (!cloudSyncEnabled || !normalizedEmail || !normalizedPassword) {
      return
    }

    setBusy(true)
    setError(null)
    setStatus(null)

    try {
      if (mode === 'signUp') {
        const result = await signUpCloudUser(normalizedEmail, normalizedPassword)
        setStatus(
          result.requiresEmailConfirmation
            ? copy.route.cloudSignUpCheckEmail
            : copy.route.cloudSignUpSuccess,
        )
        if (!result.requiresEmailConfirmation) {
          navigate({ to: redirectPath })
        }
      } else {
        await signInCloudUser(normalizedEmail, normalizedPassword)
        navigate({ to: redirectPath })
      }
    } catch {
      setError(mode === 'signUp' ? copy.route.cloudSignUpError : copy.route.cloudSignInError)
    } finally {
      setBusy(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!cloudSyncEnabled) {
      return
    }

    setBusy(true)
    setError(null)
    setStatus(null)

    try {
      const callbackUrl = new URL('/auth', window.location.origin)
      callbackUrl.searchParams.set('flow', 'oauth')
      if (redirectPath !== '/') {
        callbackUrl.searchParams.set('redirect', redirectPath)
      }
      const redirectTo = callbackUrl.toString()
      await signInCloudUserWithGoogle(redirectTo)
    } catch {
      setError(copy.route.authGoogleError)
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    if (!cloudSyncEnabled) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await signOutCloudUser()
      setStatus(copy.route.cloudSignedOut)
    } catch {
      setError(copy.route.cloudSignOutError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <header className={styles.header}>
          <h1>{copy.route.authPageTitle}</h1>
          <p className={styles.subtitle}>{copy.route.authPageSubtitle}</p>
        </header>

        {!cloudSyncEnabled ? <p className={styles.hint}>{copy.route.cloudSyncSetupHint}</p> : null}

        {cloudSyncEnabled && !hasUser ? (
          <>
            <div className={styles.modeActions}>
              <button
                type="button"
                className={mode === 'signIn' ? styles.active : undefined}
                onClick={() => setMode('signIn')}
                disabled={busy}
              >
                {copy.route.cloudSignInAction}
              </button>
              <button
                type="button"
                className={mode === 'signUp' ? styles.active : undefined}
                onClick={() => setMode('signUp')}
                disabled={busy}
              >
                {copy.route.cloudSignUpAction}
              </button>
            </div>

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                void handleEmailAuth()
              }}
            >
              <label>
                {copy.route.cloudEmailLabel}
                <input
                  type="email"
                  value={email}
                  required
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                {copy.route.cloudPasswordLabel}
                <input
                  type="password"
                  value={password}
                  required
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? copy.route.cloudSyncingAction : mode === 'signUp' ? copy.route.cloudSignUpAction : copy.route.cloudSignInAction}
              </button>
            </form>

            <button
              type="button"
              className={styles.googleButton}
              onClick={handleGoogleSignIn}
              disabled={busy}
            >
              {copy.route.authGoogleAction}
            </button>
          </>
        ) : null}

        {cloudSyncEnabled && hasUser ? (
          <div className={styles.actionsRow}>
            <p className={styles.hint}>
              {userEmail ? copy.route.authSignedInAs(userEmail) : copy.route.authNoEmail}
            </p>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                if (!normalizedName) {
                  return
                }

                void (async () => {
                  setBusy(true)
                  setError(null)

                  try {
                    await updateCloudUserName(normalizedName)
                    setStatus(copy.route.authProfileSaved)
                  } catch {
                    setError(copy.route.authNameSaveError)
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              <label>
                <span>{copy.route.authNameLabel}</span>
                <input
                  type="text"
                  value={name}
                  placeholder={copy.route.authNamePlaceholder}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <button type="submit" disabled={busy || !normalizedName}>
                {busy ? copy.route.cloudSyncingAction : copy.common.save}
              </button>
            </form>
            <button type="button" className={styles.googleButton} onClick={handleSignOut} disabled={busy}>
              {copy.route.cloudSignOutAction}
            </button>
          </div>
        ) : null}

        {cloudSyncEnabled && !hasUser && !status ? (
          <p className={styles.hint}>{copy.route.authSignedOutHint}</p>
        ) : null}

        {status ? <p className={styles.status}>{status}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <Link to={redirectPath} className={styles.secondaryLink}>
          {copy.route.authBackToDashboard}
        </Link>

        <nav className={styles.legalLinks} aria-label="Legal links">
          <Link to="/privacy" className={styles.legalLink}>
            Privacy Policy
          </Link>
          <Link to="/terms" className={styles.legalLink}>
            Terms of Service
          </Link>
        </nav>
      </section>
    </main>
  )
}
