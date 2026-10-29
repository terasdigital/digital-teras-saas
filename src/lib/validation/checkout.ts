import { z } from 'zod'

/**
 * Pembeli adalah anon dan nomornya bebas (tidak harus 628xx — itu aturan
 * untuk nomor SELLER). Longgar tapi masuk akal: 8–15 digit bila diisi.
 */
export const buyerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Isi nama kamu dulu ya (minimal 2 karakter)')
    .max(80, 'Nama terlalu panjang'),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[^\d]/g, ''))
    .refine((s) => s === '' || /^[0-9]{8,15}$/.test(s), {
      message: 'No. HP pengisi saja 8–15 digit, atau kosongkan',
    })
    .transform((s) => (s === '' ? null : s)),
  note: z
    .string()
    .trim()
    .max(300, 'Catatan maksimal 300 karakter')
    .transform((s) => (s.replace(/\s+/g, ' ').trim() === '' ? null : s.replace(/\s+/g, ' ').trim())),
})

export const checkoutLineSchema = z.object({
  variantId: z.uuid(),
  qty: z.number().int().min(1, 'Minimal 1').max(99, 'Maksimal 99 per produk'),
})

export const checkoutSchema = z.object({
  storeSlug: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/, 'Slug toko tidak valid'),
  buyer: buyerSchema,
  // harga TIDAK ikut dikirim — otoritas harga ada di DB (place_order)
  lines: z.array(checkoutLineSchema).min(1, 'Keranjangmu masih kosong').max(50),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export type CheckoutResult =
  | { ok: true; waUrl: string; ref: string }
  | { error: string }
