'use client'

import { AlertCircle } from 'lucide-react'
import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

/**
 * Form primitives.
 *
 * `Field` owns the id wiring so that every control is programmatically bound to
 * its label, its description and its error message. Components below read that
 * context instead of each caller repeating `aria-describedby` by hand.
 */

type FieldContextValue = {
  inputId: string
  descriptionId: string
  errorId: string
  hasError: boolean
  required: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

function useFieldContext() {
  return useContext(FieldContext)
}

export function Field({
  label,
  htmlFor,
  description,
  error,
  required,
  className,
  children,
}: {
  label?: string
  htmlFor?: string
  description?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  const generatedId = useId()
  const inputId = htmlFor ?? `field-${generatedId}`

  const value: FieldContextValue = {
    inputId,
    descriptionId: `${inputId}-description`,
    errorId: `${inputId}-error`,
    hasError: Boolean(error),
    required: Boolean(required),
  }

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('space-y-1.5', className)}>
        {label ? (
          <div className="flex items-center gap-0.5">
            <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
              {label}
            </label>
            {required ? (
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            ) : null}
          </div>
        ) : null}

        {children}

        {description && !error ? (
          <p id={value.descriptionId} className="text-xs text-foreground-subtle">
            {description}
          </p>
        ) : null}

        {error ? (
          <p
            id={value.errorId}
            role="alert"
            className="flex items-start gap-1.5 text-xs font-medium text-danger"
          >
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

const CONTROL_BASE = cn(
  'w-full rounded-[var(--radius-app)] border bg-surface px-3 text-sm text-foreground',
  'border-[var(--border-strong)] placeholder:text-foreground-subtle',
  'transition-colors duration-150',
  'hover:border-[color-mix(in_oklab,var(--border-strong),var(--foreground)_18%)]',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
)

function useControlProps() {
  const field = useFieldContext()
  if (!field) return {}
  return {
    id: field.inputId,
    'aria-invalid': field.hasError || undefined,
    'aria-required': field.required || undefined,
    'aria-describedby': field.hasError ? field.errorId : field.descriptionId,
  }
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const controlProps = useControlProps()
  const field = useFieldContext()

  return (
    <input
      {...controlProps}
      className={cn(CONTROL_BASE, 'h-9.5', field?.hasError && 'border-danger', className)}
      {...props}
    />
  )
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const controlProps = useControlProps()
  const field = useFieldContext()

  return (
    <textarea
      {...controlProps}
      rows={rows}
      className={cn(
        CONTROL_BASE,
        'resize-y py-2 leading-relaxed',
        field?.hasError && 'border-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const controlProps = useControlProps()
  const field = useFieldContext()

  return (
    <div className="relative">
      <select
        {...controlProps}
        className={cn(
          CONTROL_BASE,
          'h-9.5 cursor-pointer appearance-none pr-9',
          field?.hasError && 'border-danger',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-foreground-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Checkbox({
  className,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const generatedId = useId()
  const id = props.id ?? `checkbox-${generatedId}`

  return (
    <div className="flex items-center gap-2.5">
      <input
        type="checkbox"
        id={id}
        className={cn(
          'size-4 cursor-pointer rounded border-[var(--border-strong)] accent-[var(--primary)]',
          className,
        )}
        {...props}
      />
      {label ? (
        <label htmlFor={id} className="cursor-pointer text-sm text-foreground select-none">
          {label}
        </label>
      ) : null}
    </div>
  )
}

/** An accessible on/off control, used throughout Settings. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-60',
          checked ? 'bg-primary' : 'bg-[var(--border-strong)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-150',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}
