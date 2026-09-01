'use client'

import { Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { useTheme } from '@/components/layout/theme-provider'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { FormError } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage, fieldErrors } from '@/lib/api/client'
import { PROJECT_COLORS } from '@/lib/constants'
import { cn, initials } from '@/lib/utils'
import type { ThemePreference, UserDTO, UserSettingsDTO } from '@/types'

/* -------------------------------------------------------------------------- */
/*                                   Profile                                  */
/* -------------------------------------------------------------------------- */

export function ProfilePanel({ user }: { user: UserDTO }) {
  const router = useRouter()
  const toast = useToast()

  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [avatarColor, setAvatarColor] = useState(user.avatarColor)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setSaving(true)

    try {
      await api.account.updateProfile({ name: name.trim(), email: email.trim(), avatarColor })
      toast.success('Profile updated')
      router.refresh()
    } catch (error) {
      const fields = fieldErrors(error)
      if (Object.keys(fields).length > 0) setErrors(fields)
      setFormError(Object.keys(fields).length > 0 ? null : errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Profile" description="How you appear inside TaskFlow." />
      <form onSubmit={handleSubmit} noValidate>
        <CardBody className="space-y-4">
          <FormError message={formError} />

          <div className="flex items-center gap-4">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: avatarColor }}
              aria-hidden="true"
            >
              {initials(name || user.name)}
            </span>
            <div>
              <p className="text-xs font-medium text-foreground">Avatar colour</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    aria-label={`Use avatar colour ${color}`}
                    aria-pressed={avatarColor === color}
                    className={cn(
                      'size-6 rounded-full transition-transform',
                      avatarColor === color
                        ? 'ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--surface)]'
                        : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <Field label="Name" error={errors.name} required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              disabled={saving}
            />
          </Field>

          <Field label="Email" error={errors.email} required>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={saving}
            />
          </Field>
        </CardBody>
        <CardFooter className="justify-end">
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Appearance                                 */
/* -------------------------------------------------------------------------- */

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function AppearancePanel({ settings }: { settings: UserSettingsDTO }) {
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const router = useRouter()
  const [weekStartsOn, setWeekStartsOn] = useState(settings.weekStartsOn)
  const [saving, setSaving] = useState(false)

  async function persist(patch: Partial<UserSettingsDTO>) {
    setSaving(true)
    try {
      await api.settings.update(patch)
      router.refresh()
    } catch (error) {
      toast.error('Could not save your preference', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function chooseTheme(next: ThemePreference) {
    // Apply immediately from the cookie-backed provider, then persist to the
    // account so the choice follows the user to another device.
    setTheme(next)
    await persist({ theme: next })
  }

  return (
    <Card>
      <CardHeader title="Appearance" description="Theme and calendar preferences." />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Theme</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => chooseTheme(value)}
                disabled={saving}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-[var(--radius-app)] border p-3 transition-colors',
                  theme === value
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-[var(--border)] text-foreground-muted hover:border-[var(--border-strong)] hover:text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-foreground-subtle">
            &ldquo;System&rdquo; follows your operating system setting and changes with it.
          </p>
        </div>

        <Field label="Week starts on" htmlFor="week-start">
          <Select
            id="week-start"
            value={String(weekStartsOn)}
            disabled={saving}
            onChange={(event) => {
              const next = Number(event.target.value)
              setWeekStartsOn(next)
              void persist({ weekStartsOn: next })
            }}
          >
            <option value="1">Monday</option>
            <option value="0">Sunday</option>
          </Select>
        </Field>
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Notifications                               */
/* -------------------------------------------------------------------------- */

export function NotificationsPanel({ settings }: { settings: UserSettingsDTO }) {
  const toast = useToast()
  const router = useRouter()
  const [values, setValues] = useState(settings)
  const [saving, setSaving] = useState(false)

  async function update(patch: Partial<UserSettingsDTO>) {
    const previous = values
    setValues((current) => ({ ...current, ...patch }))
    setSaving(true)
    try {
      await api.settings.update(patch)
      router.refresh()
    } catch (error) {
      setValues(previous)
      toast.error('Could not save your preference', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Notifications"
        description="Stored on your account, ready for a delivery integration. Nothing is sent yet."
      />
      <CardBody className="divide-y divide-[var(--border)] pt-0">
        <Switch
          label="Email notifications"
          description="The master switch for anything that would be sent to your inbox."
          checked={values.emailNotifications}
          disabled={saving}
          onCheckedChange={(next) => update({ emailNotifications: next })}
        />
        <Switch
          label="Due date reminders"
          description="Remind me when a task with a reminder time is coming up."
          checked={values.dueDateReminders}
          disabled={saving || !values.emailNotifications}
          onCheckedChange={(next) => update({ dueDateReminders: next })}
        />
        <Switch
          label="Weekly digest"
          description="A Monday summary of what is due and what slipped."
          checked={values.weeklyDigest}
          disabled={saving || !values.emailNotifications}
          onCheckedChange={(next) => update({ weeklyDigest: next })}
        />
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Security                                 */
/* -------------------------------------------------------------------------- */

export function PasswordPanel() {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setSaving(true)

    try {
      await api.account.changePassword({ currentPassword, newPassword })
      toast.success('Password changed', 'Other devices have been signed out.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (error) {
      const fields = fieldErrors(error)
      if (Object.keys(fields).length > 0) setErrors(fields)
      setFormError(Object.keys(fields).length > 0 ? null : errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Changing it signs out every other device, keeping this one."
      />
      <form onSubmit={handleSubmit} noValidate>
        <CardBody className="space-y-4">
          <FormError message={formError} />

          <Field label="Current password" error={errors.currentPassword} required>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={saving}
            />
          </Field>

          <Field
            label="New password"
            error={errors.newPassword}
            description="At least 8 characters."
            required
          >
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
            />
          </Field>
        </CardBody>
        <CardFooter className="justify-end">
          <Button type="submit" loading={saving} disabled={!currentPassword || !newPassword}>
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Danger zone                                 */
/* -------------------------------------------------------------------------- */

export function DangerZonePanel({ taskCount, projectCount }: { taskCount: number; projectCount: number }) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteAccount() {
    setDeleting(true)
    try {
      await api.account.remove()
      router.replace('/signup')
      router.refresh()
    } catch (error) {
      toast.error('Could not delete your account', errorMessage(error))
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <Card className="border-danger/30">
        <CardHeader
          title="Delete account"
          description="Removes your account and everything in it. This cannot be undone."
        />
        <CardBody>
          <p className="text-sm text-foreground-muted">
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'} and {projectCount}{' '}
            {projectCount === 1 ? 'project' : 'projects'} will be deleted along with your account.
          </p>
        </CardBody>
        <CardFooter className="justify-end border-danger/20">
          <Button
            variant="danger"
            onClick={() => setConfirming(true)}
            leadingIcon={<Trash2 className="size-4" />}
          >
            Delete my account
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={confirming}
        loading={deleting}
        onClose={() => setConfirming(false)}
        onConfirm={deleteAccount}
        title="Delete your account?"
        confirmLabel="Yes, delete everything"
        message={
          <>
            Your account, {taskCount} {taskCount === 1 ? 'task' : 'tasks'} and {projectCount}{' '}
            {projectCount === 1 ? 'project' : 'projects'} will be permanently deleted. There is no way
            to recover them.
          </>
        }
      />
    </>
  )
}
