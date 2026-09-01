import { CheckCircle2, CalendarDays, LayoutDashboard, Tags } from 'lucide-react'
import type { ReactNode } from 'react'

const HIGHLIGHTS = [
  { icon: LayoutDashboard, title: 'A dashboard that adds up', body: 'Every number is computed from your tasks, live.' },
  { icon: CalendarDays, title: 'Deadlines in context', body: 'Due dates, reminders and a month view you can scan.' },
  { icon: Tags, title: 'Projects and tags', body: 'Group work the way you actually think about it.' },
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Decorative panel: hidden on small screens rather than shrunk. */}
      <aside className="relative hidden overflow-hidden bg-slate-950 p-12 text-slate-100 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(60% 55% at 15% 10%, rgba(99,102,241,0.35), transparent 70%), radial-gradient(50% 45% at 85% 85%, rgba(14,165,233,0.28), transparent 70%)',
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">TaskFlow</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">
            Everything you owe the week, in one place.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Capture the work, give it a deadline and a priority, and let the dashboard tell you what is
            actually behind.
          </p>

          <ul className="mt-9 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">Built with Next.js, PostgreSQL and Drizzle.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
