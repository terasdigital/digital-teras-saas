import type { CSSProperties } from 'react'
import type { Theme } from '@/lib/validation/theme'

/**
 * Palet kurasi (semua kontras dengan teks otomatis) — free & micro hanya
 * boleh memilih dari sini; Pro bebas hex (flag plans.limits.custom_accent).
 */
export const ACCENT_SWATCHES = [
  '#171717', //_graphite
  '#b91c1c', // merah cabai
  '#c2410c', // oranye terakota
  '#a16207', // amber kunyit
  '#15803d', // hijau daun
  '#0f766e', // teal laut
  '#1d4ed8', // biru
  '#7e22ce', // ungu
] as const

export const RADIUS_PX: Record<Theme['radius'], string> = {
  sm: '0.375rem',
  md: '0.75rem',
  xl: '1.125rem',
}

/**
 * Warna teks di atas aksen: luminance relatif > 0.6 → tinta gelap,
 * selainnya putih. (Dua arah saja — dijamin kontras utk semua swatch &
 * hex bebas yang wajar.)
 */
export function fgFor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return '#ffffff'
  const n = parseInt(m[1]!, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1c1917' : '#ffffff'
}

export function isCuratedAccent(hex: string): boolean {
  return (ACCENT_SWATCHES as readonly string[]).includes(hex.toLowerCase())
}

/**
 * CSS variables yang DI-INLINE di HTML pertama etalase (server render →
 * tanpa FOUC). Komponen memakai var(--dt-accent) dst. via kelas .dt-*.
 */
export function themeStyleVars(theme: Theme): CSSProperties {
  return {
    ['--dt-accent' as string]: theme.accent,
    ['--dt-accent-fg' as string]: fgFor(theme.accent),
    ['--dt-radius' as string]: RADIUS_PX[theme.radius],
  } as CSSProperties
}

export function themeRootClass(theme: Theme): string {
  return `dt-store dt-font-${theme.font} dt-button-${theme.button}`
}
