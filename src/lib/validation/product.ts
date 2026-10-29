import { z } from 'zod'
import { parseRupiahInput } from '@/lib/format'
import { assetPathSchema } from '@/lib/validation/store'

export const productNameSchema = z
  .string()
  .trim()
  .min(2, 'Nama produk minimal 2 karakter')
  .max(60, 'Nama produk maksimal 60 karakter')

export const productDescriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Deskripsi maksimal 2000 karakter')
  .optional()

/**
 * Pengetikan uang: tolak typosurat & negatif yang diam-diam "bersih"
 * setelah parse (mis. "-5" → 5 bila hanya dibersihkan digitnya).
 */
function looksNumeric(s: string): boolean {
  const noMinus = !s.includes('-')
  const noLetters = s.replace(/rp/gi, '').search(/[a-z]/i) === -1
  return noMinus && noLetters
}

/** Input rupiah bebas ("Rp25.000", "25.000") → integer IDR ≥ 0. */
export const priceInputSchema = z
  .string()
  .trim()
  .refine(looksNumeric, {
    message: 'Harga harus angka saja, mis. 25.000',
  })
  .transform(parseRupiahInput)
  .refine((v): v is number => v !== null && v >= 0, {
    message: 'Harga tidak valid — isi angka, mis. 25.000',
  })
  .refine((v) => v <= 1_000_000_000_000, { message: 'Harga terlalu mustahil 😅' })

/** '' = stok tidak dilacak; angka ≥ 0 = lacak stok. */
export const stockInputSchema = z
  .string()
  .trim()
  .refine(looksNumeric, {
    message: 'Stok harus angka ≥ 0 (kosongkan bila tidak dilacak)',
  })
  .transform((s) => (s === '' ? null : parseRupiahInput(s)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0), {
    message: 'Stok harus angka ≥ 0 (kosongkan bila tidak dilacak)',
  })

export const variantRowSchema = z.object({
  id: z.uuid().nullish().transform((v) => v ?? null),
  name: z.string().trim().max(40, 'Nama varian maksimal 40 karakter'),
  priceInput: z.string(),
  stockInput: z.string(),
})

export const variantsJsonSchema = z
  .string()
  .transform((s): unknown => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  })
  .pipe(z.array(variantRowSchema).min(1, 'Minimal satu varian').max(30))

export const productFormSchema = z.object({
  name: productNameSchema,
  description: productDescriptionSchema,
  imagePath: assetPathSchema.nullable(),
  hasVariants: z.boolean(),
  variantsJson: z.string(),
})

export type ProductFormInput = z.infer<typeof productFormSchema>

/** Varian siap-kirim ke RPC upsert_product. */
export const rpcVariantSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().min(1).max(40),
  price: z.number().int().min(0),
  stock: z.number().int().min(0).nullable(),
})
export type RpcVariant = z.infer<typeof rpcVariantSchema>

export type ProductFormResult = {
  error?: string
  ok?: boolean
  productId?: string
} | null

/**
 * Bentuk payload form → daftar varian RPC.
 * Mode "tanpa varian": baris pertama dipaksa bernama Default (id-nya
 * dipertahankan bila produk sudah punya varian) — jadi mengedit tidak
 * menghapus-membuat ulang varian setiap simpan.
 */
export function buildVariants(
  input: ProductFormInput,
): { variants: RpcVariant[] } | { error: string } {
  const parsed = variantsJsonSchema.safeParse(input.variantsJson)
  if (!parsed.success) {
    return { error: 'Daftar varian rusak — muat ulang halaman lalu coba lagi.' }
  }

  let rows = parsed.data
  if (!input.hasVariants) {
    const first = rows[0]!
    rows = [{ ...first, name: 'Default' }]
  }

  const variants: RpcVariant[] = []
  for (const row of rows) {
    const label = input.hasVariants ? `Varian "${row.name || '(kosong)'}"` : 'Harga produk'
    if (!input.hasVariants && (row.name ?? '') === '' && rows.length > 1) {
      return { error: 'Mode tanpa varian hanya boleh satu baris.' }
    }
    if (input.hasVariants && row.name === '') {
      return { error: `Nama varian tidak boleh kosong (mis. "Merah · L").` }
    }
    const price = priceInputSchema.safeParse(row.priceInput)
    if (!price.success) return { error: `${label}: ${price.error.issues[0]?.message}` }
    const stock = stockInputSchema.safeParse(row.stockInput)
    if (!stock.success) return { error: `${label}: ${stock.error.issues[0]?.message}` }
    variants.push({
      id: row.id,
      name: row.name || 'Default',
      price: price.data,
      stock: stock.data ?? null,
    })
  }
  return { variants }
}
