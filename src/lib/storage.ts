import { env } from '@/lib/env'

export const STORE_ASSETS_BUCKET = 'store-assets'

/**
 * Gambar disimpan sebagai PATH relatif bucket (bukan URL penuh) —
 * tahan terhadap pergantian domain/proyek. Helper ini satu-satunya
 * tempat path → URL.
 */
export function assetUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path // keamanan bila data lama berupa URL
  return `${env.SUPABASE_URL}/storage/v1/object/public/${STORE_ASSETS_BUCKET}/${path}`
}

/** Path storage baru milik user: `{uid}/stores/{storeId|draft}/{purpose}-{ts}.{ext}` */
export function buildAssetPath(
  userId: string,
  storeId: string,
  purpose: 'avatar' | 'banner' | 'produk',
  ext: string,
): string {
  const ts = Date.now().toString(36)
  return `${userId}/stores/${storeId}/${purpose}-${ts}.${ext}`
}

const ALLOWED_EXT = new Set(['webp', 'jpg', 'jpeg', 'png'])

/** Ekstensi aman dari nama file; null bila tipe tidak didukung. */
export function safeImageExt(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXT.has(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : null
}
