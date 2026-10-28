import { z } from 'zod'

/**
 * Variabel lingkungan publik (NEXT_PUBLIC_*) — aman dipakai di klien & server.
 * Validasi saat module load agar kesalahan konfigurasi terlihat cepat, bukan
 * saat user menekan tombol.
 */
const publicEnvSchema = z.object({
  APP_URL: z.url().default('http://localhost:3000'),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
})

export const env = publicEnvSchema.parse({
  APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})
