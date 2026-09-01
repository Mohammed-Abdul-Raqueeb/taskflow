import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'

import { ThemeProvider, TimeZoneSync, themeInitScript } from '@/components/layout/theme-provider'
import { ToastProvider } from '@/components/ui/toast'
import { THEME_COOKIE_NAME, THEMES } from '@/lib/constants'
import type { ThemePreference } from '@/types'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'TaskFlow',
    template: '%s · TaskFlow',
  },
  description:
    'TaskFlow is a task manager for people juggling several projects: priorities, due dates, tags and a dashboard that keeps the numbers honest.',
  applicationName: 'TaskFlow',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#111624' },
  ],
}

function isThemePreference(value: string | undefined): value is ThemePreference {
  return THEMES.includes((value ?? '') as ThemePreference)
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const cookieTheme = jar.get(THEME_COOKIE_NAME)?.value
  const theme: ThemePreference = isThemePreference(cookieTheme) ? cookieTheme : 'system'

  return (
    // `suppressHydrationWarning` because the inline script below may add the
    // `dark` class before React hydrates, which is the whole point of it.
    <html lang="en" className={theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider initialTheme={theme}>
          <ToastProvider>
            <TimeZoneSync />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
