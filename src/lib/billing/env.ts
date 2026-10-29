import 'server-only'

import { z } from 'zod'

/**
 * Konfigurasi Midtrans — HANYA modul billing yang membacanya (server),
 * divalidasi lazy: build/dev tanpa key tetap jalan; error muncul saat
 * fitur upgrade benar-benar dipakai.
 */
const schema = z.object({
  SERVER_KEY: z.string().min(1),
  IS_PAID: z.boolean().default(false),
  // dasar URL notifikasi — default NEXT_PUBLIC_APP_URL; dev bisa isi URL
  // tunnel (mis. https://abc.trycloudflare.com) via MIDTRANS_WEBHOOK_BASE
  WEBHOOK_BASE: z.url(),
})

export type MidtransConfig = z.infer<typeof schema>

export function getMidtransConfig(): MidtransConfig {
  try {
    return schema.parse({
      SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
      IS_PAID: process.env.MIDTRANS_IS_PAID_MODE === 'true',
      WEBHOOK_BASE:
        process.env.MIDTRANS_WEBHOOK_BASE ?? process.env.NEXT_PUBLIC_APP_URL,
    })
  } catch {
    throw new Error(
      'Midtrans belum dikonfigurasi — isi MIDTRANS_SERVER_KEY (dan opsional MIDTRANS_WEBHOOK_BASE) di .env.local. Saat dev: jalankan tunnel dan arahkan MIDTRANS_WEBHOOK_BASE ke URL publiknya.',
    )
  }
}

export function apiBase(cfg: MidtransConfig): string {
  return cfg.IS_PAID ? 'https://app.midtrans.com' : 'https://api.sandbox.midtrans.com'
}

export function snapBase(cfg: MidtransConfig): string {
  return cfg.IS_PAID
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
}
