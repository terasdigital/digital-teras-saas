import { z } from 'zod'
import { SLUG_REGEX, isReservedSlug } from '@/lib/slug'
import { isLikelyIndonesianMobile, normalizeWhatsappNumber } from '@/lib/wa-number'

export const storeNameSchema = z
  .string()
  .trim()
  .min(3, 'Nama toko minimal 3 karakter')
  .max(60, 'Nama toko maksimal 60 karakter')

export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Alamat toko minimal 3 karakter')
  .max(30, 'Alamat toko maksimal 30 karakter')
  .refine((s) => SLUG_REGEX.test(s), {
    message: 'Hanya huruf kecil, angka, dan strip; tidak boleh mulai/berakhir dengan strip',
  })
  .refine((s) => !isReservedSlug(s), {
    message: 'Nama itu sudah dicadangkan — pilih yang lain ya',
  })

export const whatsappInputSchema = z
  .string()
  .trim()
  .min(8, 'Nomor WhatsApp terlalu pendek — contoh: 0812-3456-7890')
  .transform(normalizeWhatsappNumber)
  .refine(isLikelyIndonesianMobile, {
    message:
      'Nomor WhatsApp harus nomor seluler Indonesia — mulai 08xx atau +62 8xx',
  })

export const taglineSchema = z
  .string()
  .trim()
  .max(120, 'Tagline maksimal 120 karakter')
  .optional()

export const bioSchema = z
  .string()
  .trim()
  .max(500, 'Deskripsi maksimal 500 karakter')
  .optional()

/**
 * Path gambar dari alur signed-upload: selalu diawali uid penulis
 * (dijaga storage policy) — divalidasi lagi terhadap uid user saat submit.
 */
export const assetPathSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/stores\/[\w.-]+\/(avatar|banner)-[0-9a-z]+\.(webp|jpg|png)$/,
    'Path gambar tidak valid',
  )

export const onboardingSchema = z.object({
  name: storeNameSchema,
  slug: storeSlugSchema,
  whatsapp: whatsappInputSchema,
  tagline: taglineSchema,
  bio: bioSchema,
  avatarPath: assetPathSchema.optional(),
  bannerPath: assetPathSchema.optional(),
})

export const updateStoreSchema = z.object({
  name: storeNameSchema,
  whatsapp: whatsappInputSchema,
  tagline: taglineSchema,
  bio: bioSchema,
  published: z.boolean(),
  avatarPath: assetPathSchema.nullable(),
  bannerPath: assetPathSchema.nullable(),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>

/** Bentuk hasil aksi form (dipakai useActionState). */
export type StoreFormResult = {
  error?: string
  ok?: boolean
  /** Slug toko yang baru dibuat — untuk pesan sukses + tombol copy. */
  createdSlug?: string
} | null

export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Data tidak valid'
}
