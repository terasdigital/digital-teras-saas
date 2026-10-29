'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getOwnStore } from '@/lib/db/queries/dashboard'
import { isReservedSlug, isValidSlug, normalizeSlug } from '@/lib/slug'
import { buildAssetPath, safeImageExt, STORE_ASSETS_BUCKET } from '@/lib/storage'
import {
  onboardingSchema,
  updateStoreSchema,
  zodMessage,
  type StoreFormResult,
} from '@/lib/validation/store'

/** Pesan exception Postgres kita sudah berbahasa Indonesia — pakai apa adanya. */
function userError(message: string | undefined, fallback: string): string {
  const m = (message ?? '').trim()
  return m.length > 0 && m.length < 200 ? m : fallback
}

/** Path harus berada di folder uid pemilik — jangan percaya klien. */
function pathOwnedByUser(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`)
}

export async function createStoreAction(
  _prev: StoreFormResult,
  formData: FormData,
): Promise<StoreFormResult> {
  const user = await requireUser()

  const parsed = onboardingSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    whatsapp: formData.get('whatsapp'),
    tagline: String(formData.get('tagline') ?? '').trim() || undefined,
    bio: String(formData.get('bio') ?? '').trim() || undefined,
    avatarPath: String(formData.get('avatarPath') ?? '') || undefined,
    bannerPath: String(formData.get('bannerPath') ?? '') || undefined,
  })
  if (!parsed.success) return { error: zodMessage(parsed.error) }

  if (parsed.data.avatarPath && !pathOwnedByUser(parsed.data.avatarPath, user.id)) {
    return { error: 'File avatar tidak dikenali — upload ulang ya.' }
  }
  if (parsed.data.bannerPath && !pathOwnedByUser(parsed.data.bannerPath, user.id)) {
    return { error: 'File banner tidak dikenali — upload ulang ya.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_store', {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_whatsapp: parsed.data.whatsapp,
    p_tagline: parsed.data.tagline ?? null,
    p_bio: parsed.data.bio ?? null,
    p_avatar_path: parsed.data.avatarPath ?? null,
    p_banner_path: parsed.data.bannerPath ?? null,
  })
  if (error) {
    return { error: userError(error.message, 'Gagal membuat toko. Coba lagi ya.') }
  }

  const created = data as { id: string; slug: string; name: string }
  revalidatePath('/dashboard')
  return { ok: true, createdSlug: created.slug }
}

/** Live-check ketersediaan slug (dipanggil wizard dengan debounce). */
export async function checkSlugAvailability(
  rawSlug: string,
): Promise<{ available: boolean; message?: string }> {
  await requireUser()
  const slug = normalizeSlug(rawSlug)

  if (slug.length < 3) return { available: false, message: 'Minimal 3 karakter ya.' }
  if (slug.length > 30) return { available: false, message: 'Maksimal 30 karakter.' }
  if (isReservedSlug(slug)) return { available: false, message: 'Nama itu dicadangkan — pilih lain ya.' }
  if (!isValidSlug(slug)) return { available: false, message: 'Hanya huruf kecil, angka, dan strip.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_store_slug_available', { p_slug: slug })
  if (error) return { available: false, message: 'Gagal memeriksa — coba lagi.' }
  return data
    ? { available: true }
    : { available: false, message: 'Alamat itu sudah dipakai toko lain.' }
}

/**
 * Siapkan jalur upload gambar: return path bertanda (uid user wajib jadi folder
 * pertama — dipaksa storage policy) + token untuk uploadToSignedUrl di browser.
 * Bytes tidak pernah lewat server kita.
 */
export async function prepareImageUpload(
  purpose: 'avatar' | 'banner' | 'produk',
  filename: string,
): Promise<{ path?: string; token?: string; error?: string }> {
  const user = await requireUser()
  const ext = safeImageExt(filename)
  if (!ext) return { error: 'Format gambar harus webp/jpg/png.' }

  const store = await getOwnStore(user.id)
  const path = buildAssetPath(user.id, store?.id ?? 'draft', purpose, ext)

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(STORE_ASSETS_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) return { error: 'Gagal menyiapkan ruang upload. Coba lagi.' }

  return { path: data.path, token: data.token }
}

export async function updateStoreAction(
  _prev: StoreFormResult,
  formData: FormData,
): Promise<StoreFormResult> {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return { error: 'Toko tidak ditemukan — mulai dari onboarding dulu ya.' }

  const parsed = updateStoreSchema.safeParse({
    name: formData.get('name'),
    whatsapp: formData.get('whatsapp'),
    tagline: String(formData.get('tagline') ?? '').trim() || undefined,
    bio: String(formData.get('bio') ?? '').trim() || undefined,
    published: formData.get('published') === 'on',
    avatarPath: String(formData.get('avatarPath') ?? '') || null,
    bannerPath: String(formData.get('bannerPath') ?? '') || null,
  })
  if (!parsed.success) return { error: zodMessage(parsed.error) }

  for (const p of [parsed.data.avatarPath, parsed.data.bannerPath]) {
    if (p && !pathOwnedByUser(p, user.id)) {
      return { error: 'File gambar tidak dikenali — upload ulang ya.' }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('stores')
    .update({
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      tagline: parsed.data.tagline ?? null,
      bio: parsed.data.bio ?? null,
      published: parsed.data.published,
      avatar_path: parsed.data.avatarPath,
      banner_path: parsed.data.bannerPath,
    })
    .eq('id', store.id)
  if (error) return { error: userError(error.message, 'Gagal menyimpan perubahan.') }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/toko')
  return { ok: true }
}
