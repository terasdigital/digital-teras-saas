import 'server-only'

import { updateTag } from 'next/cache'

/**
 * Panggil SETIAP mutasi seller (profil toko, publish toggle, produk, varian,
 * link) agar etalase publik `store:{slug}` langsung kadaluarsa.
 *
 * Kenapa `updateTag`, bukan `revalidateTag(tag, 'max')`?
 * - revalidateTag = stale-while-revalidate: halaman lama tetap dilayani
 *   sambil diregenerasi di background → seller melihat DATANYA SENDIRI
 *   basi sesaat setelah menekan Simpan (bug yang dilaporkan).
 * - updateTag = kadaluwarsa seketika (read-your-own-writes) — request
 *   berikutnya ke /{slug} membangun ulang dan langsung menampilkan hasil
 *   edit. Hanya legal di Server Action, dan semua call site kita memang
 *   server action.
 */
export function revalidateStore(storeSlug: string): void {
  updateTag(`store:${storeSlug}`)
}
