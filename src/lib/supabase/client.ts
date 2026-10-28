'use client'

import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'

/** Client Supabase untuk komponen browser (event handler, fetch real-time). */
export function createClient() {
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
}
