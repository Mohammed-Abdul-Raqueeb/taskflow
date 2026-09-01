import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** "Ada Lovelace" -> "AL". Used by the avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase()
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Readable text colour for an arbitrary background, using relative luminance. */
export function contrastingTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return '#ffffff'
  const toLinear = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const r = toLinear(parseInt(hex.slice(0, 2), 16))
  const g = toLinear(parseInt(hex.slice(2, 4), 16))
  const b = toLinear(parseInt(hex.slice(4, 6), 16))
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.45 ? '#0f172a' : '#ffffff'
}

/** Hex plus alpha, for tinted badge backgrounds built from a project colour. */
export function withAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return hexColor
  const value = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${hex}${value}`
}
