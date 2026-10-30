import 'server-only'

/**
 * Token-window sederhana IN-MEMORI — best-effort di serverless (per instance).
 * Untuk MVP ini cukup sebagai rem first-line; guard otoritatif tetap validasi
 * DB (harga dihitung ulang, ref unik, dsb). Bila volume menuntut, ganti dengan
 * Upstash/Redis di M9.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()
const MAX_KEYS = 10_000

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()

  // prune kasual saat tabel membengkak
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k)
    }
  }

  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= limit) return false
  b.count += 1
  return true
}

export function clientIp(headers: { get(name: string): string | null }): string {
  const fwd = headers.get('x-forwarded-for')
  return (fwd?.split(',')[0]?.trim() || 'unknown').slice(0, 64)
}
