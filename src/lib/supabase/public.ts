import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Klien khusus PEMBAACAAN DATA PUBLIK (views public_* via role anon).
 * Sengaja tidak membaca cookie sesi — supaya bisa dipakai di dalam scope
 * `"use cache"` (yang melarang cookies()). RLS tetap berlaku: views hanya
 * expose toko published + konten aktif, dan kolom sensitif tidak ada di view.
 */
let cached: SupabaseClient | null = null

export function getPublicClient(): SupabaseClient {
  cached ??= createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
