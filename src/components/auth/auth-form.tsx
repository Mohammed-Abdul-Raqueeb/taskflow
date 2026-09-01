'use client'

import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { FormError } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage, fieldErrors } from '@/lib/api/client'
import { parseOrThrow, signInSchema, signUpSchema } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

/**
 * Sign-in and sign-up share this component because they differ only by one
 * field and one endpoint.
 *
 * The same Zod schemas the server uses run here too, which gives instant inline
 * feedback -- but the server validates independently and its field errors win,
 * so nothing here is load-bearing for correctness.
 */

type Mode = 'signin' | 'signup'

/** Only allow relative paths, so `?next=` cannot bounce the user off-site. */
function safeRedirect(target: string | null): string {
  if (!target) return '/dashboard'
  if (!target.startsWith('/') || target.startsWith('//')) return '/dashboard'
  return target
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isSignUp = mode === 'signup'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)

    let payload: { name?: string; email: string; password: string }
    try {
      payload = isSignUp
        ? parseOrThrow(signUpSchema, { name, email, password })
        : parseOrThrow(signInSchema, { email, password })
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors(error.fields ?? {})
        setFormError(error.fields ? null : error.message)
        return
      }
      throw error
    }

    setSubmitting(true)
    try {
      if (isSignUp) {
        await api.auth.signUp(payload as { name: string; email: string; password: string })
        toast.success('Welcome to TaskFlow', 'Your account is ready.')
      } else {
        await api.auth.signIn(payload)
      }

      const destination = safeRedirect(searchParams.get('next'))
      router.replace(destination)
      // Discard the cached signed-out tree so the app shell renders signed in.
      router.refresh()
    } catch (error) {
      const fields = fieldErrors(error)
      if (Object.keys(fields).length > 0) setErrors(fields)
      setFormError(Object.keys(fields).length > 0 ? null : errorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-8 lg:hidden">
        <span className="inline-flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">TaskFlow</span>
        </span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {isSignUp ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-1.5 text-sm text-foreground-muted">
        {isSignUp
          ? 'A minute to set up, and your first project is ready.'
          : 'Sign in to pick up where you left off.'}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <FormError message={formError} />

        {isSignUp ? (
          <Field label="Name" error={errors.name} required>
            <Input
              name="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
            />
          </Field>
        ) : null}

        <Field label="Email" error={errors.email} required>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
          />
        </Field>

        <Field
          label="Password"
          error={errors.password}
          description={isSignUp ? 'At least 8 characters.' : undefined}
          required
        >
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder={isSignUp ? 'Choose a strong password' : 'Your password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-foreground-subtle transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-foreground-muted">
        {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
        <Link
          href={isSignUp ? '/login' : '/signup'}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {isSignUp ? 'Sign in' : 'Create an account'}
        </Link>
      </p>

      {!isSignUp ? (
        <div className="mt-8 rounded-[var(--radius-app)] border border-[var(--border)] bg-surface-muted/60 p-3.5">
          <p className="text-xs font-medium text-foreground">Demo account</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground-subtle">
            After running <code className="font-mono">npm run db:seed</code>, sign in with{' '}
            <span className="font-mono text-foreground">demo@taskflow.app</span> /{' '}
            <span className="font-mono text-foreground">demo1234</span>.
          </p>
        </div>
      ) : null}
    </div>
  )
}
