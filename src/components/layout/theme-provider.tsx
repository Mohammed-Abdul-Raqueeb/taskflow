'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { THEME_COOKIE_NAME, TIMEZONE_COOKIE_NAME } from '@/lib/constants'
import type { ThemePreference } from '@/types'

/**
 * Theme state.
 *
 * The preference lives in a cookie so the server can render the correct theme
 * on the very first response -- no flash of the wrong colours. Signed-in users
 * also have it persisted to their account, which the settings page writes.
 */

type ThemeContextValue = {
  theme: ThemePreference
  /** What "system" currently resolves to. */
  resolvedTheme: 'light' | 'dark'
  setTheme: (next: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToColorScheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function writeCookie(name: string, value: string) {
  // A year, readable by the server on the next request, and not a secret.
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemePreference
  children: ReactNode
}) {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme)

  /*
   * The OS preference is an external store, so read it as one. That keeps
   * "system" reactive without an effect that mirrors it into state, and gives
   * the server a defined value (false) to render against.
   */
  const systemPrefersDark = useSyncExternalStore(
    subscribeToColorScheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  )

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme

  // The one genuine side effect: keeping the document in step with the theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    writeCookie(THEME_COOKIE_NAME, next)
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Reports the browser's IANA time zone to the server via a cookie.
 *
 * "Overdue" and "due today" are decided server-side, so the server needs to
 * know which calendar the viewer is on. Runs once and only writes when the
 * value has actually changed.
 */
export function TimeZoneSync() {
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!timeZone) return

    const current = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${TIMEZONE_COOKIE_NAME}=`))
      ?.split('=')[1]

    if (current && decodeURIComponent(current) === timeZone) return

    writeCookie(TIMEZONE_COOKIE_NAME, timeZone)
  }, [])

  return null
}

/**
 * Runs before first paint so "system" resolves without a flash of light theme.
 * Inlined into <head>; it must stay dependency-free and synchronous.
 */
export const themeInitScript = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|; )${THEME_COOKIE_NAME}=([^;]*)/);
    var pref = match ? decodeURIComponent(match[1]) : 'system';
    var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (error) {}
})();
`.trim()
