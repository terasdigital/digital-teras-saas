'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getOwnStore } from '@/lib/db/queries/dashboard'
import { getProduct } from '@/lib/db/queries/product'
import { buildVariants, productFormSchema, type ProductFormResult } from '@/lib/validation/product'

function pgError(message: string | undefined, fallback: string): string {
  const m = (message ?? '').trim()
  // pesan exception RPC kita sudah berbahasa Indonesia; yang lain → generic
  if (m && m.length < 240 && !/duplicate key|violates row-level security|constraint/i.test(m)) {
    return m
  }
  return fallback
}

export async function saveProductAction(
  productId: string | null,
  formData: FormData,
): Promise<ProductFormResult> {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Buat toko dulu ya.' }

  const parsed = productFormSchema.safeParse({
    name: formData.get('name'),
    description: String(formData.get('description') ?? '').trim() || undefined,
    imagePath: String(formData.get('imagePath') ?? '') || null,
    hasVariants: formData.get('hasVariants') === 'on',
    variantsJson: String(formData.get('variantsJson') ?? '[]'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }
  }
  const form = parsed.data

  if (form.imagePath && !form.imagePath.startsWith(`${user.id}/`)) {
    return { error: 'File gambar tidak dikenali — upload ulang ya.' }
  }

  const built = buildVariants(form)
  if ('error' in built) return { error: built.error }

  // Edit produk nonaktif tidak boleh diam-diam mengaktifkannya lagi.
  let isActive = true
  if (productId) {
    const existing = await getProduct(store.id, productId)
    if (!existing) return { error: 'Produk tidak ditemukan — mungkin sudah dihapus.' }
    isActive = existing.is_active
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('upsert_product', {
    p_id: productId,
    p_name: form.name,
    p_description: form.description ?? null,
    p_image_path: form.imagePath,
    p_is_active: isActive,
    p_variants: built.variants,
  })
  if (error) {
    return { error: pgError(error.message, 'Gagal menyimpan produk. Coba lagi ya.') }
  }

  revalidatePath('/dashboard/produk')
  const created = data as { id: string } | null
  return { ok: true, productId: created?.id ?? productId ?? undefined }
}

export async function setProductActiveAction(
  productId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Toko tidak ditemukan.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .update({ is_active: active })
    .eq('id', productId)
    .eq('store_id', store.id)
  if (error) return { error: 'Gagal mengubah status produk.' }

  revalidatePath('/dashboard/produk')
  return {}
}

export async function deleteProductAction(
  productId: string,
): Promise<{ error?: string }> {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Toko tidak ditemukan.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('store_id', store.id)
  if (error) return { error: 'Gagal menghapus produk.' }

  revalidatePath('/dashboard/produk')
  return {}
}
