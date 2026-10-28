import 'server-only'

import { createClient } from '@/lib/supabase/server'

/** Baris stores — sampai tipe hasil `gen types` tersedia, bentuk riil kolom di sini. */
export interface StoreRow {
  id: string
  owner_id: string
  slug: string
  name: string
  tagline: string | null
  bio: string | null
  avatar_path: string | null
  banner_path: string | null
  whatsapp: string
  published: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * Toko milik user (RLS juga membatasi; owner_id filter eksplisit = cepat via indeks).
 * Bukan `use cache` — data dashboard harus read-your-own-writes setelah aksi.
 */
export async function getOwnStore(userId: string): Promise<StoreRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle()
  return (data as StoreRow) ?? null
}

export async function getSubscriptionInfo(storeId: string) {
  const supabase = await createClient()
  const [{ data: sub }, plan] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan_code, status, current_period_end')
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase.rpc('effective_plan', { p_store: storeId }).then((r) => r.data as string | null),
  ])
  return {
    subscription: sub as
      | { plan_code: string; status: string; current_period_end: string | null }
      | null,
    effectivePlan: plan ?? 'free',
  }
}
