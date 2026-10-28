import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { env } from '@/lib/env'

/**
 * Client Supabase untuk Server Component / Server Action / Route Handler.
 * Membaca cookie request; percobaan set-cookie dari RSC gagal senyap (normal).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Dipanggil dari Server Component — tidak bisa menulis cookie;
          // middleware yang akan menyegarkan sesi.
        }
      },
    },
  })
}
