import { z } from 'zod'

export const LAYOUTS = ['linktree', 'grid', 'katalog'] as const
export const RADII = ['sm', 'md', 'xl'] as const
export const FONTS = ['sans', 'rounded', 'serif'] as const
export const BUTTON_STYLES = ['solid', 'outline'] as const

export const themeSchema = z.object({
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Warna aksen harus hex, mis. #1d4ed8'),
  layout: z.enum(LAYOUTS),
  radius: z.enum(RADII),
  font: z.enum(FONTS),
  button: z.enum(BUTTON_STYLES),
  show_powered: z.boolean(),
})

export type Theme = z.infer<typeof themeSchema>

export const DEFAULT_THEME: Theme = {
  accent: '#171717',
  layout: 'grid',
  radius: 'md',
  font: 'sans',
  button: 'solid',
  show_powered: true,
}

/**
 * Pembaca SELALU pakai ini — blob settings lama/rusak tidak boleh
 * menjatuhkan etalase publik (.catch mengembalikan default).
 */
export function readTheme(settings: unknown): Theme {
  const raw =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>).theme
      : undefined
  return themeSchema.catch(DEFAULT_THEME).parse(raw ?? DEFAULT_THEME)
}
