import { z } from 'zod'

export const TRACK_TYPES = [
  'visit',
  'link_click',
  'product_view',
  'cart_add',
  'checkout',
] as const

export type TrackType = (typeof TRACK_TYPES)[number]

/** Payload POST /api/track (beacon). 'order' TIDAK bisa dikirim klien —
 *  hanya dicatat server-side oleh place_order. */
export const trackPayloadSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/, 'slug tidak valid'),
  type: z.enum(TRACK_TYPES),
  target: z.uuid().nullish(),
  sid: z.uuid().nullish(),
  path: z.string().max(300).nullish(),
})
