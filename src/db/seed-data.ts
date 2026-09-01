import type { TaskPriority, TaskStatus } from '@/db/schema'

/**
 * Demo content for `npm run db:seed`.
 *
 * Kept out of the application bundle on purpose: nothing here is imported by a
 * page or component, so the production UI has no hard-coded tasks.
 *
 * Due dates are expressed as day offsets from the moment the seed runs, so a
 * freshly seeded database always has a believable spread of overdue, due-today
 * and upcoming work rather than a wall of stale dates.
 */

export type SeedProject = {
  key: string
  name: string
  description: string
  color: string
}

export type SeedTask = {
  title: string
  description?: string
  project?: string
  status: TaskStatus
  priority: TaskPriority
  /** Whole days from "now". Omit for a task with no due date. */
  dueInDays?: number
  /** Hour of the day, in the seeding machine's local zone. */
  dueHour?: number
  tags?: string[]
  /** Days before the due date to fire a reminder. */
  remindDaysBefore?: number
  /** Days ago the task was completed. Only meaningful for COMPLETED tasks. */
  completedDaysAgo?: number
  /** Days ago the task was created. Defaults to a spread over the last month. */
  createdDaysAgo?: number
}

export const SEED_PROJECTS: SeedProject[] = [
  {
    key: 'website',
    name: 'Website Redesign',
    description: 'Rebuild the marketing site on the new design system before the autumn launch.',
    color: '#6366f1',
  },
  {
    key: 'mobile',
    name: 'Mobile App',
    description: 'iOS and Android parity work, plus the offline sync milestone.',
    color: '#0ea5e9',
  },
  {
    key: 'marketing',
    name: 'Marketing Q3',
    description: 'Campaign planning, content calendar and launch collateral.',
    color: '#f59e0b',
  },
  {
    key: 'ops',
    name: 'Operations',
    description: 'Vendor renewals, onboarding and the quarterly compliance review.',
    color: '#10b981',
  },
  {
    key: 'personal',
    name: 'Personal',
    description: 'Errands and everything that does not belong to a work project.',
    color: '#ec4899',
  },
]

export const SEED_TAGS: { name: string; color: string }[] = [
  { name: 'design', color: '#8b5cf6' },
  { name: 'frontend', color: '#0ea5e9' },
  { name: 'backend', color: '#10b981' },
  { name: 'research', color: '#64748b' },
  { name: 'bug', color: '#f43f5e' },
  { name: 'meeting', color: '#f59e0b' },
  { name: 'docs', color: '#64748b' },
  { name: 'finance', color: '#10b981' },
  { name: 'health', color: '#ec4899' },
  { name: 'quick-win', color: '#0ea5e9' },
]

export const SEED_TASKS: SeedTask[] = [
  /* ------------------------------- Overdue ------------------------------- */
  {
    title: 'Fix layout shift on the pricing page',
    description:
      'Largest Contentful Paint jumps when the testimonial carousel loads. Reserve space for the image and re-measure on a throttled connection.',
    project: 'website',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    dueInDays: -3,
    dueHour: 17,
    tags: ['frontend', 'bug'],
    createdDaysAgo: 12,
  },
  {
    title: 'Renew the analytics contract',
    description: 'Legal has approved the new terms. Countersign and file the PDF in the vendor folder.',
    project: 'ops',
    status: 'TODO',
    priority: 'HIGH',
    dueInDays: -2,
    dueHour: 12,
    tags: ['finance'],
    createdDaysAgo: 20,
  },
  {
    title: 'Send the Q2 retrospective notes',
    project: 'marketing',
    status: 'TODO',
    priority: 'MEDIUM',
    dueInDays: -6,
    dueHour: 10,
    tags: ['docs', 'meeting'],
    createdDaysAgo: 18,
  },
  {
    title: 'Book the dentist appointment',
    project: 'personal',
    status: 'TODO',
    priority: 'LOW',
    dueInDays: -9,
    dueHour: 9,
    tags: ['health', 'quick-win'],
    createdDaysAgo: 25,
  },

  /* ------------------------------ Due today ------------------------------ */
  {
    title: 'Review the onboarding flow copy',
    description: 'Second pass on the four empty-state screens. Focus on the wording of the first-run tips.',
    project: 'mobile',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueInDays: 0,
    dueHour: 16,
    tags: ['design', 'docs'],
    remindDaysBefore: 0,
    createdDaysAgo: 5,
  },
  {
    title: 'Standup with the platform team',
    project: 'ops',
    status: 'TODO',
    priority: 'MEDIUM',
    dueInDays: 0,
    dueHour: 9,
    tags: ['meeting'],
    createdDaysAgo: 1,
  },
  {
    title: 'Ship the dark mode toggle',
    description: 'Theme preference persists per account and follows the system setting by default.',
    project: 'website',
    status: 'TODO',
    priority: 'URGENT',
    dueInDays: 0,
    dueHour: 18,
    tags: ['frontend', 'design'],
    createdDaysAgo: 4,
  },

  /* ------------------------------ This week ------------------------------ */
  {
    title: 'Draft the launch announcement',
    description: 'Blog post plus the three social variants. Keep it under 600 words.',
    project: 'marketing',
    status: 'TODO',
    priority: 'HIGH',
    dueInDays: 2,
    dueHour: 14,
    tags: ['docs'],
    remindDaysBefore: 1,
    createdDaysAgo: 6,
  },
  {
    title: 'Migrate the session store to Postgres',
    description: 'Replace the in-memory store so sessions survive a deploy. Include a rollback plan.',
    project: 'mobile',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueInDays: 3,
    dueHour: 17,
    tags: ['backend'],
    createdDaysAgo: 9,
  },
  {
    title: 'Audit the colour contrast on badges',
    project: 'website',
    status: 'TODO',
    priority: 'MEDIUM',
    dueInDays: 4,
    dueHour: 11,
    tags: ['design', 'frontend'],
    createdDaysAgo: 3,
  },
  {
    title: 'Interview: senior product designer',
    project: 'ops',
    status: 'TODO',
    priority: 'HIGH',
    dueInDays: 1,
    dueHour: 13,
    tags: ['meeting'],
    remindDaysBefore: 1,
    createdDaysAgo: 7,
  },
  {
    title: 'Groceries and refill the coffee order',
    project: 'personal',
    status: 'TODO',
    priority: 'LOW',
    dueInDays: 2,
    dueHour: 19,
    tags: ['quick-win'],
    createdDaysAgo: 2,
  },

  /* ------------------------------- Upcoming ------------------------------ */
  {
    title: 'Offline sync spike',
    description:
      'Compare a queue-and-replay approach against CRDTs for the notes feature. One page of findings, with a recommendation.',
    project: 'mobile',
    status: 'TODO',
    priority: 'MEDIUM',
    dueInDays: 8,
    dueHour: 17,
    tags: ['research', 'backend'],
    createdDaysAgo: 4,
  },
  {
    title: 'Quarterly compliance review',
    project: 'ops',
    status: 'TODO',
    priority: 'HIGH',
    dueInDays: 12,
    dueHour: 10,
    tags: ['docs', 'finance'],
    remindDaysBefore: 3,
    createdDaysAgo: 14,
  },
  {
    title: 'Rewrite the API reference introduction',
    project: 'website',
    status: 'TODO',
    priority: 'LOW',
    dueInDays: 15,
    dueHour: 12,
    tags: ['docs'],
    createdDaysAgo: 8,
  },
  {
    title: 'Plan the customer advisory session',
    project: 'marketing',
    status: 'TODO',
    priority: 'MEDIUM',
    dueInDays: 20,
    dueHour: 15,
    tags: ['meeting', 'research'],
    createdDaysAgo: 10,
  },
  {
    title: 'Instrument the new funnel events',
    project: 'marketing',
    status: 'TODO',
    priority: 'MEDIUM',
    dueInDays: 6,
    dueHour: 16,
    tags: ['backend'],
    createdDaysAgo: 5,
  },

  /* ------------------------------ No due date ---------------------------- */
  {
    title: 'Collect ideas for the design system v2',
    description: 'Running list. No deadline yet, revisit after the launch settles.',
    project: 'website',
    status: 'TODO',
    priority: 'LOW',
    tags: ['design', 'research'],
    createdDaysAgo: 22,
  },
  {
    title: 'Read the accessibility guidelines update',
    status: 'TODO',
    priority: 'LOW',
    tags: ['research', 'docs'],
    createdDaysAgo: 16,
  },
  {
    title: 'Try the new profiler on a cold start',
    project: 'mobile',
    status: 'TODO',
    priority: 'LOW',
    tags: ['research'],
    createdDaysAgo: 11,
  },

  /* ------------------------------- Completed ----------------------------- */
  {
    title: 'Set up the staging environment',
    description: 'Mirrors production with seeded data and its own database branch.',
    project: 'ops',
    status: 'COMPLETED',
    priority: 'HIGH',
    dueInDays: -8,
    dueHour: 17,
    tags: ['backend'],
    completedDaysAgo: 8,
    createdDaysAgo: 21,
  },
  {
    title: 'Pick the typeface for the new brand',
    project: 'website',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    dueInDays: -10,
    dueHour: 12,
    tags: ['design'],
    completedDaysAgo: 10,
    createdDaysAgo: 26,
  },
  {
    title: 'Fix the crash on rotate in the editor',
    project: 'mobile',
    status: 'COMPLETED',
    priority: 'URGENT',
    dueInDays: -5,
    dueHour: 15,
    tags: ['bug', 'frontend'],
    completedDaysAgo: 5,
    createdDaysAgo: 13,
  },
  {
    title: 'Publish the July newsletter',
    project: 'marketing',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    dueInDays: -12,
    dueHour: 10,
    tags: ['docs'],
    completedDaysAgo: 12,
    createdDaysAgo: 24,
  },
  {
    title: 'Cancel the unused seat licences',
    project: 'ops',
    status: 'COMPLETED',
    priority: 'LOW',
    dueInDays: -4,
    dueHour: 11,
    tags: ['finance', 'quick-win'],
    completedDaysAgo: 4,
    createdDaysAgo: 15,
  },
  {
    title: 'Set up the recurring 1:1s',
    project: 'ops',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    tags: ['meeting'],
    completedDaysAgo: 2,
    createdDaysAgo: 9,
  },
  {
    title: 'Book the flights for the offsite',
    project: 'personal',
    status: 'COMPLETED',
    priority: 'HIGH',
    dueInDays: -1,
    dueHour: 20,
    tags: ['quick-win'],
    completedDaysAgo: 1,
    createdDaysAgo: 6,
  },
  {
    title: 'Replace the deprecated image component',
    project: 'website',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    dueInDays: -3,
    dueHour: 16,
    tags: ['frontend'],
    completedDaysAgo: 3,
    createdDaysAgo: 10,
  },
  {
    title: 'Write the incident postmortem',
    project: 'ops',
    status: 'COMPLETED',
    priority: 'HIGH',
    dueInDays: -7,
    dueHour: 14,
    tags: ['docs'],
    completedDaysAgo: 6,
    createdDaysAgo: 12,
  },
  {
    title: 'Update the onboarding screenshots',
    project: 'marketing',
    status: 'COMPLETED',
    priority: 'LOW',
    tags: ['design', 'quick-win'],
    completedDaysAgo: 7,
    createdDaysAgo: 17,
  },
]

/** A second account, so cross-user isolation can be checked by hand. */
export const SEED_SECOND_USER = {
  email: 'alex@taskflow.app',
  name: 'Alex Rivera',
  password: 'demo1234',
  projectName: 'Alex private research',
  tasks: [
    { title: 'Alex only: draft the grant proposal', priority: 'HIGH' as TaskPriority },
    { title: 'Alex only: review the lab budget', priority: 'MEDIUM' as TaskPriority },
  ],
}
