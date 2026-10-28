import 'server-only'

import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { cacheLife } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * User yang login saat ini.
 *
 * `'use cache: private'` (pola auth resmi untuk Cache Components):
 * - membaca `cookies()` di dalam scope cache — diizinkan hanya di private cache;
 * - dieksekusi saat request time dan DIKECUALIKAN dari static shell generation,
 *   sehingga konstruktor GoTrueClient (yang memanggil Date.now() untuk
 *   auto-refresh token) tidak pernah berjalan pada prerender pass.
 * - hasil di-dedupe per request; `stale: Infinity` agar tidak menurunkan
 *   stale time rute (logout/refresh sesi langsung terlihat).
 */
export async function getSessionUser() {
  'use cache: private'
  cacheLife({ stale: Infinity })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Baca sesi dalam mode render request-time.
 *
 * `connection()` menandai boundary sebagai dinamis SEBELUM klien Supabase
 * dibuat. Private cache saja tidak cukup: di dev, hard refresh memicu jalur
 * "server caches disabled" yang tetap menjalankan prerender pass — tanpa
 * penanda eksplisit ini, konstruktor GoTrueClient (Date.now) error lagi.
 */
export async function readSessionUser() {
  await connection()
  return getSessionUser()
}

/** Wajib sesi — kalau tidak ada, lempar redirect ke /login. */
export async function requireUser() {
  const user = await readSessionUser()
  if (!user) redirect('/login')
  return user
}

/** Profil (nama/phone) milik user aktif. */
export async function getProfile(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data
}
