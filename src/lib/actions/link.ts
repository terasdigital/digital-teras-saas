'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { getOwnStore } from '@/lib/db/queries/dashboard'
import { createClient } from '@/lib/supabase/server'
import { revalidateStore } from '@/lib/cache'
import { linkSchema } from '@/lib/validation/link'

export type LinkActionResult = { error?: string; ok?: boolean } | null

async function requireStore() {
  const user = await requireUser()
  const store = await getOwnStore(user.id)
  if (!store) return null
  return store
}

function touch(storeSlug: string) {
  revalidateStore(storeSlug)
  revalidatePath('/dashboard/toko')
}

export async function addLinkAction(
  _prev: LinkActionResult,
  formData: FormData,
): Promise<LinkActionResult> {
  const store = await requireStore()
  if (!store) return { error: 'Buat toko dulu ya.' }

  const parsed = linkSchema.safeParse({
    label: formData.get('label'),
    url: formData.get('url'),
    icon: String(formData.get('icon') ?? '') || null,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }
  }

  // batas link dari paket — guard yang sama dgn halaman produk
  const supabase = await createClient()
  const { data: guard } = await supabase.rpc('can_create', {
    p_store: store.id,
    p_kind: 'link',
  })
  const g = guard as { can: boolean; used: number; limit: number | null } | null
  if (g && g.can !== true) {
    return {
      error: `Paket kamu maksimal ${g.limit} tautan (pakai ${g.used}). Tautan upgrade hadir di Milestone 7.`,
    }
  }

  const { count } = await supabase
    .from('links')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', store.id)
  const position = count ?? 0

  const { error } = await supabase.from('links').insert({
    store_id: store.id,
    label: parsed.data.label,
    url: parsed.data.url,
    icon: parsed.data.icon,
    position,
  })
  if (error) return { error: 'Gagal menambah tautan.' }

  touch(store.slug)
  return { ok: true }
}

export async function setLinkEnabledAction(
  linkId: string,
  enabled: boolean,
): Promise<LinkActionResult> {
  const store = await requireStore()
  if (!store) return { error: 'Toko tidak ditemukan.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('links')
    .update({ enabled })
    .eq('id', linkId)
    .eq('store_id', store.id)
  if (error) return { error: 'Gagal mengubah tautan.' }
  touch(store.slug)
  return { ok: true }
}

export async function deleteLinkAction(linkId: string): Promise<LinkActionResult> {
  const store = await requireStore()
  if (!store) return { error: 'Toko tidak ditemukan.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('links')
    .delete()
    .eq('id', linkId)
    .eq('store_id', store.id)
  if (error) return { error: 'Gagal menghapus tautan.' }
  touch(store.slug)
  return { ok: true }
}
