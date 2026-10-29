import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { getPublicClient } from '@/lib/supabase/public'

export interface PublicVariant {
  id: string
  name: string
  price_idr: number
  stock: number | null
}

export interface PublicStore {
  id: string
  slug: string
  name: string
  tagline: string | null
  bio: string | null
  avatar_path: string | null
  banner_path: string | null
  whatsapp: string
  settings: Record<string, unknown>
}

export interface PublicLink {
  id: string
  label: string
  url: string
  icon: string | null
  position: number
}

export interface PublicProduct {
  id: string
  name: string
  slug: string
  description: string | null
  image_path: string | null
  price_idr: number
  position: number
  variants: PublicVariant[]
}

export interface StorefrontData {
  store: PublicStore
  links: PublicLink[]
  products: PublicProduct[]
}

/**
 * SATU pintu resolusi toko publik (slug — nanti host/subdomain ikut di sini).
 *
 * `"use cache"`: halaman etalase adalah konten publik → layak di-prerender
 * & dilayani dari cache dengan stale-while-revalidate; mutasi seller memanggil
 * revalidateStore(slug). Data di-key oleh tag, bukan argumen, jadi aman.
 */
export async function getStorefront(storeSlug: string): Promise<StorefrontData | null> {
  'use cache'
  cacheTag(`store:${storeSlug}`)
  cacheLife('hours')

  const supabase = getPublicClient()
  const { data: store } = await supabase
    .from('public_storefront')
    .select('*')
    .eq('slug', storeSlug)
    .maybeSingle()
  if (!store) return null

  const typedStore = store as PublicStore

  const [linksRes, productsRes] = await Promise.all([
    supabase
      .from('public_links')
      .select('*')
      .eq('store_id', typedStore.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('public_products')
      .select('*')
      .eq('store_id', typedStore.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  return {
    store: typedStore,
    links: (linksRes.data as PublicLink[]) ?? [],
    products: ((productsRes.data as (Omit<PublicProduct, 'variants'> & { variants: unknown })[]) ?? [])
      .map((p) => ({ ...p, variants: normalizeVariants(p.variants) })),
  }
}

export async function getProductPage(
  storeSlug: string,
  productSlug: string,
): Promise<{ store: PublicStore; product: PublicProduct } | null> {
  'use cache'
  cacheTag(`store:${storeSlug}`)
  cacheLife('hours')

  const supabase = getPublicClient()
  const [{ data: store }, { data: product }] = await Promise.all([
    supabase
      .from('public_storefront')
      .select('*')
      .eq('slug', storeSlug)
      .maybeSingle(),
    supabase
      .from('public_products')
      .select('*')
      .eq('store_slug', storeSlug)
      .eq('slug', productSlug)
      .maybeSingle(),
  ])
  if (!store || !product) return null
  const { variants, ...rest } = product as Omit<PublicProduct, 'variants'> & {
    variants: unknown
  }
  return {
    store: store as PublicStore,
    product: { ...rest, variants: normalizeVariants(variants) } as PublicProduct,
  }
}

function normalizeVariants(raw: unknown): PublicVariant[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => ({
    id: String(v.id ?? ''),
    name: String(v.name ?? 'Default'),
    price_idr: Number(v.price_idr ?? 0),
    stock: v.stock === null || v.stock === undefined ? null : Number(v.stock),
  }))
}
