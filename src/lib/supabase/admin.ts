import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '@/lib/env'

const serverEnvSchema = z.object({
  SERVICE_ROLE_KEY: z.string().min(1),
})

const serverEnv = serverEnvSchema.parse({
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})

/**
 * Client service-role — HANYA untuk jalur server terkontrol (webhook, cron,
 * rollup analitik). Jangan pernah diimpor dari modul klien/route publik:
 * RLS di-bypass di sini.
 */
export function createAdminClient() {
  return createClient(env.SUPABASE_URL, serverEnv.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
