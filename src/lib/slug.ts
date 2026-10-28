/**
 * Slug toko publik (domain.com/<slug>). Ditegakkan di tiga tempat:
 * Zod (form), fungsi ini (helper), dan regex CHECK + daftar reserved di
 * RPC create_store (defense in depth).
 */

export const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/
export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 30

/** Nama yang tidak boleh dipakai toko karena menabrak rute aplikasi. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // rute aplikasi
  'dashboard',
  'onboarding',
  'login',
  'register',
  'logout',
  'auth',
  'callback',
  'pricing',
  'legal',
  'terms',
  'privacy',
  'help',
  'support',
  'about',
  'tentang',
  'harga',
  'akun',
  'saya',
  'admin',
  'app',
  'api',
  'assets',
  'static',
  'store',
  'stores',
  'shop',
  'shops',
  'toko',
  'explore',
  'search',
  'cari',
  'track',
  'webhooks',
  'img',
  'cdn',
  'sitemap',
  'robots',
  'favicon',
  '_next',
  // Indonesia & umum yang terlalu mudah menipu
  'digitalteras',
  'digital-teras',
  'terasmu',
  'official',
  'verifikasi',
  'resmi',
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN_LENGTH &&
    slug.length <= SLUG_MAX_LENGTH &&
    SLUG_REGEX.test(slug) &&
    !isReservedSlug(slug)
  )
}

/** "Toko Kopi Aku!" → "toko-kopi-aku". Input bebas, output slug aman. */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD') // buang aksen (é → e)
    .replace(/[^a-z0-9]+/g, '-') // deretan karakter asing → satu strip
    .replace(/^-+|-+$/g, '') // strip di tepi
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '') // slice bisa meninggalkan strip di ujung
}

/** Saran slug dari nama toko untuk wizard onboarding. */
export function suggestSlug(name: string): string {
  const base = normalizeSlug(name)
  if (base.length >= SLUG_MIN_LENGTH && !isReservedSlug(base)) return base
  return base
}
