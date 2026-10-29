import { z } from 'zod'

export const LINK_ICONS = [
  'instagram',
  'tiktok',
  'whatsapp',
  'tokopedia',
  'shopee',
  'youtube',
  'email',
  'phone',
  'website',
] as const

export const linkSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'Label minimal 2 karakter')
    .max(40, 'Label maksimal 40 karakter'),
  url: z
    .string()
    .trim()
    .min(1, 'Isi URL-nya')
    .max(290, 'URL terlalu panjang')
    .transform((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
    .refine((s) => /^https?:\/\/[^.]+\..+/.test(s), {
      message: 'URL tidak valid — contoh: instagram.com/namatoko',
    }),
  icon: z.enum(LINK_ICONS).nullish().transform((v) => v ?? null),
})

export type LinkInput = z.infer<typeof linkSchema>
